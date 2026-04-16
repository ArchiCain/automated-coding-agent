export interface HealthCheckResult {
  status: 'ok' | 'error';
  service: string;
  responseTime?: number;
  error?: string;
}

export interface DatabaseCheckResult {
  connected: boolean;
  tables?: string[];
  error?: string;
}
