import { useState, useEffect, useCallback, useRef } from 'react';
import type { PodInfo, ServiceInfo, NamespaceGroup } from './types';

interface MetricsEntry {
  name: string;
  namespace: string;
  cpu: string;
  memory: string;
}

export function useCluster(refreshInterval = 5000) {
  const [pods, setPods] = useState<PodInfo[]>([]);
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [podsRes, servicesRes, metricsRes] = await Promise.all([
        fetch('/api/cluster/pods'),
        fetch('/api/cluster/services'),
        fetch('/api/cluster/metrics'),
      ]);

      if (!podsRes.ok || !servicesRes.ok) {
        throw new Error('Failed to fetch cluster data');
      }

      const podsData: PodInfo[] = await podsRes.json();
      const servicesData: ServiceInfo[] = await servicesRes.json();

      let metricsMap = new Map<string, { cpu: string; memory: string }>();
      if (metricsRes.ok) {
        const metricsRaw = await metricsRes.json();
        // Backend may return { pods: [...] } or [...] depending on metrics availability
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
        nsMap.set(pod.namespace, { namespace: pod.namespace, pods: [], services: [] });
      }
      nsMap.get(pod.namespace)!.pods.push(pod);
    }

    for (const svc of services) {
      if (!nsMap.has(svc.namespace)) {
        nsMap.set(svc.namespace, { namespace: svc.namespace, pods: [], services: [] });
      }
      nsMap.get(svc.namespace)!.services.push(svc);
    }

    return Array.from(nsMap.values()).sort((a, b) => a.namespace.localeCompare(b.namespace));
  })();

  return { namespaces, loading, error, lastUpdated, refresh: fetchData };
}
