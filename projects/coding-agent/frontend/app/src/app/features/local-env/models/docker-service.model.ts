/**
 * Docker service configuration
 */
export interface DockerServiceConfig {
  id: string;
  name: string;
  icon: string;
  basePort: number;
  internalPort?: number;
  healthEndpoint?: string;
  urlPath?: string;
  repoName?: string;
  oneShot?: boolean;
  /** Custom task prefix for services with non-standard task locations (e.g., "database:pgweb" for pgweb) */
  taskPrefix?: string;
  /** Port for "Open in Browser" if different from basePort (e.g., database opens pgweb) */
  browserPort?: number;
  /** Path for browser URL */
  browserPath?: string;
}

/**
 * Docker service with computed port and URL
 */
export interface DockerService extends DockerServiceConfig {
  port?: number;
  url?: string;
  /** URL for "Open in Browser" button */
  browserUrl?: string;
}

/**
 * Docker container status from docker compose ps
 */
export interface DockerContainerStatus {
  state: 'running' | 'exited' | 'dead' | 'restarting' | 'created' | 'unknown';
  health: 'healthy' | 'unhealthy' | 'starting' | null;
  /** Uptime string from docker, e.g., "47 minutes", "2 hours" */
  uptime?: string;
}

/**
 * Map of service ID to container status
 */
export type DockerStatusMap = Record<string, DockerContainerStatus>;

/**
 * Actions that can be performed on a docker service
 */
export type DockerServiceAction = 'start' | 'stop' | 'restart' | 'logs' | 'open';

/**
 * Event emitted when a docker service action is triggered
 */
export interface DockerServiceActionEvent {
  action: DockerServiceAction;
  service: DockerService;
}
