import type { NamespaceGroup } from '../cluster/types';

export type HealthStatus = 'healthy' | 'degraded' | 'failing' | 'unknown';

export interface EnvironmentSummary {
  name: string;
  type: 'main' | 'sandbox' | 'platform';
  namespace: string;
  displayName: string;
  healthStatus: HealthStatus;
  totalPods: number;
  failingPods: number;
  namespaces: NamespaceGroup[];
}
