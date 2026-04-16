import { useMemo } from 'react';
import { useCluster } from '../cluster/use-cluster';
import type { NamespaceGroup } from '../cluster/types';
import type { EnvironmentSummary, HealthStatus } from './types';

const INFRA_NAMESPACES = ['default', 'dns', 'traefik', 'registry', 'ingress-nginx', 'monitoring'];

function computeHealth(namespaces: NamespaceGroup[]): HealthStatus {
  const allPods = namespaces.flatMap((ns) => ns.pods);
  if (allPods.length === 0) return 'unknown';

  const failing = allPods.filter((p) => {
    const s = p.status.toLowerCase();
    return s === 'failed' || s === 'crashloopbackoff' || s === 'imagepullbackoff' || s === 'error';
  });

  if (failing.length === allPods.length) return 'failing';
  if (failing.length > 0) return 'degraded';
  return 'healthy';
}

function countFailing(namespaces: NamespaceGroup[]): number {
  return namespaces.flatMap((ns) => ns.pods).filter((p) => {
    const s = p.status.toLowerCase();
    return s === 'failed' || s === 'crashloopbackoff' || s === 'imagepullbackoff' || s === 'error';
  }).length;
}

export function useEnvironments() {
  const cluster = useCluster();

  const environments = useMemo<EnvironmentSummary[]>(() => {
    const envMap = new Map<string, EnvironmentSummary>();

    for (const ns of cluster.namespaces) {
      // Skip infrastructure namespaces
      if (INFRA_NAMESPACES.includes(ns.namespace)) continue;

      let envName: string;
      let envType: 'main' | 'sandbox' | 'platform';

      if (ns.namespace === 'app') {
        envName = 'main';
        envType = 'main';
      } else if (ns.namespace === 'the-dev-team') {
        envName = 'platform';
        envType = 'platform';
      } else if (ns.namespace.startsWith('env-')) {
        envName = ns.namespace.slice(4); // "env-dark-mode" -> "dark-mode"
        envType = 'sandbox';
      } else {
        // Other app namespaces group under main
        envName = 'main';
        envType = 'main';
      }

      const existing = envMap.get(envName);
      if (existing) {
        existing.namespaces.push(ns);
        existing.totalPods += ns.pods.length;
        existing.failingPods = countFailing(existing.namespaces);
        existing.healthStatus = computeHealth(existing.namespaces);
      } else {
        const namespaces = [ns];
        envMap.set(envName, {
          name: envName,
          type: envType,
          namespace: ns.namespace,
          displayName: envType === 'sandbox' ? `sandbox-${envName}` : envName,
          healthStatus: computeHealth(namespaces),
          totalPods: ns.pods.length,
          failingPods: countFailing(namespaces),
          namespaces,
        });
      }
    }

    // Sort: main first, then platform, then sandboxes alphabetically
    return Array.from(envMap.values()).sort((a, b) => {
      const order = { main: 0, platform: 1, sandbox: 2 };
      const diff = order[a.type] - order[b.type];
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    });
  }, [cluster.namespaces]);

  return { environments, ...cluster };
}
