import { useState, useEffect, useCallback, useRef } from 'react';
import type { PodInfo, ServiceInfo, NamespaceGroup } from './types';

interface MetricsEntry {
  name: string;
  namespace: string;
  cpu: string;
  memory: string;
}

/** Derive a display name for a namespace based on context */
function displayName(ns: string, env: string): string {
  if (ns === 'app') return env || 'main';
  if (ns === 'the-dev-team') return 'the-dev-team';
  if (ns.startsWith('env-')) return `sandbox-${ns.slice(4)}`;
  return ns;
}

/** Sort order: the-dev-team first, then app, then env-* alphabetically */
function sortOrder(ns: string): number {
  if (ns === 'the-dev-team') return 0;
  if (ns === 'app') return 1;
  if (ns.startsWith('env-')) return 2;
  return 3;
}

export function useCluster(refreshInterval = 5000) {
  const [pods, setPods] = useState<PodInfo[]>([]);
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [branch, setBranch] = useState('main');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [podsRes, servicesRes, metricsRes, infoRes] = await Promise.all([
        fetch('/api/cluster/pods'),
        fetch('/api/cluster/services'),
        fetch('/api/cluster/metrics'),
        fetch('/api/cluster/info'),
      ]);

      if (!podsRes.ok || !servicesRes.ok) {
        throw new Error('Failed to fetch cluster data');
      }

      const podsData: PodInfo[] = await podsRes.json();
      const servicesData: ServiceInfo[] = await servicesRes.json();

      if (infoRes.ok) {
        const info = await infoRes.json();
        if (info.branch) setBranch(info.branch);
      }

      let metricsMap = new Map<string, { cpu: string; memory: string }>();
      if (metricsRes.ok) {
        const metricsRaw = await metricsRes.json();
        const metricsData: MetricsEntry[] = Array.isArray(metricsRaw)
          ? metricsRaw
          : Array.isArray(metricsRaw?.pods)
            ? metricsRaw.pods
            : [];
        metricsMap = new Map(
          metricsData.map((m) => [`${m.namespace}/${m.name}`, { cpu: m.cpu, memory: m.memory }]),
        );
      }

      const mergedPods = podsData.map((pod) => {
        const metric = metricsMap.get(`${pod.namespace}/${pod.name}`);
        return metric ? { ...pod, cpu: metric.cpu, memory: metric.memory } : pod;
      });

      setPods(mergedPods);
      setServices(servicesData);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
    intervalRef.current = setInterval(() => void fetchData(), refreshInterval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData, refreshInterval]);

  const namespaces: NamespaceGroup[] = (() => {
    const nsMap = new Map<string, NamespaceGroup>();

    for (const pod of pods) {
      if (!nsMap.has(pod.namespace)) {
        nsMap.set(pod.namespace, {
          namespace: pod.namespace,
          displayName: displayName(pod.namespace, branch),
          pods: [],
          services: [],
        });
      }
      nsMap.get(pod.namespace)!.pods.push(pod);
    }

    for (const svc of services) {
      if (!nsMap.has(svc.namespace)) {
        nsMap.set(svc.namespace, {
          namespace: svc.namespace,
          displayName: displayName(svc.namespace, branch),
          pods: [],
          services: [],
        });
      }
      nsMap.get(svc.namespace)!.services.push(svc);
    }

    return Array.from(nsMap.values()).sort((a, b) => {
      const orderDiff = sortOrder(a.namespace) - sortOrder(b.namespace);
      if (orderDiff !== 0) return orderDiff;
      return a.namespace.localeCompare(b.namespace);
    });
  })();

  return { namespaces, loading, error, lastUpdated, refresh: fetchData };
}
