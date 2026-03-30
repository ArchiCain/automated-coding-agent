// Types for the backend health check package
export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'unknown';
  message: string;
  timestamp: string;
  uptime?: string;
  version?: string;
}

export interface HealthCheckState {
  data: HealthStatus | null;
  loading: boolean;
  error: string | null;
  lastChecked: Date | null;
}
