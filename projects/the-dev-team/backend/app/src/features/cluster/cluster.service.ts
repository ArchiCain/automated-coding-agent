import { Injectable, Logger } from '@nestjs/common';
import * as k8s from '@kubernetes/client-node';

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
    return `${millicores}m`;
  }

  private formatMemory(ki: number): string {
    if (ki >= 1024 * 1024) return `${Math.round(ki / (1024 * 1024))}Gi`;
    if (ki >= 1024) return `${Math.round(ki / 1024)}Mi`;
    return `${ki}Ki`;
  }
}
