import { Injectable, Logger } from '@nestjs/common';
import * as k8s from '@kubernetes/client-node';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execFile = promisify(execFileCb);

const SYSTEM_NAMESPACES = ['kube-system', 'kube-public', 'kube-node-lease'];

export interface ContainerInfo {
  name: string;
  image: string;
  ready: boolean;
  state: string;
  restartCount: number;
}

export interface PodInfo {
  name: string;
  namespace: string;
  status: string;
  ready: string;
  restarts: number;
  age: string;
  containers: ContainerInfo[];
  nodeName: string;
}

export interface ServiceInfo {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  ports: Array<{ port: number; targetPort: number; protocol: string }>;
  externalIP?: string;
}

export interface PodMetrics {
  name: string;
  namespace: string;
  cpu: string;
  memory: string;
}

@Injectable()
export class ClusterService {
  private readonly logger = new Logger(ClusterService.name);
  private coreApi: k8s.CoreV1Api;
  private metricsApi: k8s.CustomObjectsApi;

  constructor() {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    this.coreApi = kc.makeApiClient(k8s.CoreV1Api);
    this.metricsApi = kc.makeApiClient(k8s.CustomObjectsApi);
  }

  // ── Observability proxies ──────────────────────────────────────

  private readonly grafanaUrl = process.env.GRAFANA_URL || 'http://kube-prometheus-stack-grafana.monitoring:80';
  private readonly prometheusUrl = process.env.PROMETHEUS_URL || 'http://kube-prometheus-stack-prometheus.monitoring:9090';
  private readonly lokiUrl = process.env.LOKI_URL || 'http://loki.monitoring:3100';

  async queryPrometheus(query: string, start?: string, end?: string, step?: string): Promise<unknown> {
    try {
      const params = new URLSearchParams({ query });
      if (start && end) {
        params.set('start', start);
        params.set('end', end);
        params.set('step', step || '60');
        const res = await fetch(`${this.prometheusUrl}/api/v1/query_range?${params}`);
        return res.json();
      }
      const res = await fetch(`${this.prometheusUrl}/api/v1/query?${params}`);
      return res.json();
    } catch (error) {
      this.logger.error('Prometheus query failed', error);
      return { status: 'error', error: 'Prometheus unavailable' };
    }
  }

  async queryLoki(query: string, limit = 100, start?: string, end?: string): Promise<unknown> {
    try {
      const params = new URLSearchParams({ query, limit: String(limit) });
      if (start) params.set('start', start);
      if (end) params.set('end', end);
      const res = await fetch(`${this.lokiUrl}/loki/api/v1/query_range?${params}`);
      return res.json();
    } catch (error) {
      this.logger.error('Loki query failed', error);
      return { status: 'error', error: 'Loki unavailable' };
    }
  }

  async getGrafanaDashboards(): Promise<unknown> {
    try {
      const res = await fetch(`${this.grafanaUrl}/api/search?type=dash-db`, {
        headers: { 'Accept': 'application/json' },
      });
      return res.json();
    } catch (error) {
      this.logger.error('Grafana API failed', error);
      return [];
    }
  }

  getGrafanaUrl(): string {
    return this.grafanaUrl;
  }

  // ── Docs ────────────────────────────────────────────────────────

  private get docsRoot(): string {
    return path.join(process.env.REPO_ROOT || '/workspace', 'docs');
  }

  async listDocs(subpath = ''): Promise<{ type: 'file' | 'dir'; name: string; path: string }[]> {
    const dir = path.join(this.docsRoot, subpath);
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      return entries
        .filter((e) => e.isDirectory() || e.name.endsWith('.md'))
        .map((e) => ({
          type: e.isDirectory() ? 'dir' as const : 'file' as const,
          name: e.name.replace(/\.md$/, ''),
          path: path.join(subpath, e.name).replace(/\\/g, '/'),
        }))
        .sort((a, b) => {
          if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
    } catch {
      return [];
    }
  }

  async readDoc(filePath: string): Promise<string | null> {
    // Prevent path traversal
    const resolved = path.resolve(this.docsRoot, filePath);
    if (!resolved.startsWith(path.resolve(this.docsRoot))) return null;
    try {
      return await fs.readFile(resolved, 'utf-8');
    } catch {
      return null;
    }
  }

  // ── Repo info ──────────────────────────────────────────────────

  async getBranch(): Promise<string> {
    // Return the environment name for the app namespace display
    // Check explicit env var first, then derive from git branch
    if (process.env.DEPLOY_ENV) return process.env.DEPLOY_ENV;
    const repoRoot = process.env.REPO_ROOT || '/workspace';
    try {
      const { stdout } = await execFile('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: repoRoot });
      const branch = stdout.trim();
      // Map known branch patterns to environment names
      if (branch === 'main' || branch === 'master') return 'main';
      if (branch.startsWith('env/')) return branch.slice(4); // env/mac-mini → mac-mini
      // For feature branches, still show "main" since the app namespace deploys from main
      return 'main';
    } catch {
      return 'main';
    }
  }

  async getNamespaces(): Promise<string[]> {
    try {
      const response = await this.coreApi.listNamespace();
      return (response.items ?? [])
        .map((ns) => ns.metadata?.name ?? '')
        .filter((name) => name && !SYSTEM_NAMESPACES.includes(name));
    } catch (error) {
      this.logger.error('Failed to list namespaces', error);
      return [];
    }
  }

  async getPods(namespace?: string): Promise<PodInfo[]> {
    try {
      const response = namespace
        ? await this.coreApi.listNamespacedPod({ namespace })
        : await this.coreApi.listPodForAllNamespaces();

      return (response.items ?? [])
        .filter(
          (pod) =>
            namespace ||
            !SYSTEM_NAMESPACES.includes(pod.metadata?.namespace ?? ''),
        )
        .map((pod) => this.mapPod(pod));
    } catch (error) {
      this.logger.error('Failed to list pods', error);
      return [];
    }
  }

  async getServices(namespace?: string): Promise<ServiceInfo[]> {
    try {
      const response = namespace
        ? await this.coreApi.listNamespacedService({ namespace })
        : await this.coreApi.listServiceForAllNamespaces();

      return (response.items ?? [])
        .filter(
          (svc) =>
            namespace ||
            !SYSTEM_NAMESPACES.includes(svc.metadata?.namespace ?? ''),
        )
        .map((svc) => this.mapService(svc));
    } catch (error) {
      this.logger.error('Failed to list services', error);
      return [];
    }
  }

  async getMetrics(): Promise<{
    pods: PodMetrics[];
    note?: string;
  }> {
    try {
      const response = await this.metricsApi.listClusterCustomObject({
        group: 'metrics.k8s.io',
        version: 'v1beta1',
        plural: 'pods',
      });

      const body = response as { items?: Array<Record<string, unknown>> };
      const items = body.items ?? [];

      const pods: PodMetrics[] = items
        .filter(
          (item) =>
            !SYSTEM_NAMESPACES.includes(
              (item.metadata as { namespace?: string })?.namespace ?? '',
            ),
        )
        .map((item) => {
          const metadata = item.metadata as {
            name?: string;
            namespace?: string;
          };
          const containers = (item.containers ?? []) as Array<{
            usage?: { cpu?: string; memory?: string };
          }>;

          let totalCpu = 0;
          let totalMemoryKi = 0;

          for (const c of containers) {
            totalCpu += this.parseCpuNano(c.usage?.cpu ?? '0');
            totalMemoryKi += this.parseMemoryKi(c.usage?.memory ?? '0');
          }

          return {
            name: metadata.name ?? '',
            namespace: metadata.namespace ?? '',
            cpu: this.formatCpu(totalCpu),
            memory: this.formatMemory(totalMemoryKi),
          };
        });

      return { pods };
    } catch (error) {
      this.logger.warn('Metrics server not available', error);
      return {
        pods: [],
        note: 'Metrics server is not available. Install metrics-server to enable resource metrics.',
      };
    }
  }

  async getLogs(namespace: string, pod: string, tailLines = 200): Promise<{ lines: string[] }> {
    try {
      const response = await this.coreApi.readNamespacedPodLog({
        name: pod,
        namespace,
        tailLines,
      });
      const lines = (typeof response === 'string' ? response : String(response))
        .split('\n')
        .filter(Boolean);
      return { lines };
    } catch (error) {
      this.logger.error(`Failed to get logs for ${namespace}/${pod}`, error);
      return { lines: [`Error: Could not retrieve logs for ${pod}`] };
    }
  }

  private mapPod(pod: k8s.V1Pod): PodInfo {
    const containerStatuses = pod.status?.containerStatuses ?? [];
    const totalContainers =
      containerStatuses.length || pod.spec?.containers?.length || 0;
    const readyCount = containerStatuses.filter((cs) => cs.ready).length;
    const totalRestarts = containerStatuses.reduce(
      (sum, cs) => sum + (cs.restartCount ?? 0),
      0,
    );

    return {
      name: pod.metadata?.name ?? '',
      namespace: pod.metadata?.namespace ?? '',
      status: this.derivePodStatus(pod),
      ready: `${readyCount}/${totalContainers}`,
      restarts: totalRestarts,
      age: this.computeAge(pod.metadata?.creationTimestamp),
      containers: containerStatuses.map((cs) => ({
        name: cs.name,
        image: cs.image,
        ready: cs.ready,
        state: this.deriveContainerState(cs.state),
        restartCount: cs.restartCount ?? 0,
      })),
      nodeName: pod.spec?.nodeName ?? '',
    };
  }

  private derivePodStatus(pod: k8s.V1Pod): string {
    const containerStatuses = pod.status?.containerStatuses ?? [];

    for (const cs of containerStatuses) {
      if (cs.state?.waiting?.reason) {
        return cs.state.waiting.reason;
      }
      if (cs.state?.terminated?.reason) {
        return cs.state.terminated.reason;
      }
    }

    return pod.status?.phase ?? 'Unknown';
  }

  private deriveContainerState(
    state: k8s.V1ContainerState | undefined,
  ): string {
    if (!state) return 'unknown';
    if (state.running) return 'running';
    if (state.waiting) return 'waiting';
    if (state.terminated) return 'terminated';
    return 'unknown';
  }

  private computeAge(timestamp: Date | undefined): string {
    if (!timestamp) return 'unknown';

    const now = Date.now();
    const created = new Date(timestamp).getTime();
    const diffSeconds = Math.floor((now - created) / 1000);

    if (diffSeconds < 60) return `${diffSeconds}s`;
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h`;
    return `${Math.floor(diffSeconds / 86400)}d`;
  }

  private mapService(svc: k8s.V1Service): ServiceInfo {
    const ingress = svc.status?.loadBalancer?.ingress;
    const externalIP =
      ingress && ingress.length > 0
        ? ingress[0].ip || ingress[0].hostname
        : undefined;

    return {
      name: svc.metadata?.name ?? '',
      namespace: svc.metadata?.namespace ?? '',
      type: svc.spec?.type ?? 'ClusterIP',
      clusterIP: svc.spec?.clusterIP ?? '',
      ports: (svc.spec?.ports ?? []).map((p) => ({
        port: p.port,
        targetPort: typeof p.targetPort === 'object' ? 0 : Number(p.targetPort ?? p.port),
        protocol: p.protocol ?? 'TCP',
      })),
      ...(externalIP ? { externalIP } : {}),
    };
  }

  private parseCpuNano(cpu: string): number {
    if (cpu.endsWith('n')) return parseInt(cpu, 10);
    if (cpu.endsWith('u')) return parseInt(cpu, 10) * 1000;
    if (cpu.endsWith('m')) return parseInt(cpu, 10) * 1_000_000;
    return parseFloat(cpu) * 1_000_000_000;
  }

  private parseMemoryKi(memory: string): number {
    if (memory.endsWith('Ki')) return parseInt(memory, 10);
    if (memory.endsWith('Mi')) return parseInt(memory, 10) * 1024;
    if (memory.endsWith('Gi')) return parseInt(memory, 10) * 1024 * 1024;
    return Math.round(parseInt(memory, 10) / 1024);
  }

  private formatCpu(nanos: number): string {
    const millicores = Math.round(nanos / 1_000_000);
    if (millicores >= 1000) return `${(millicores / 1000).toFixed(1)} cores`;
    return `${millicores} mcores`;
  }

  private formatMemory(ki: number): string {
    if (ki >= 1024 * 1024) return `${Math.round(ki / (1024 * 1024))} GB`;
    if (ki >= 1024) return `${Math.round(ki / 1024)} MB`;
    return `${ki} KB`;
  }
}
