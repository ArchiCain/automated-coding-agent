import { DockerService, DockerServiceConfig } from '../models/docker-service.model';

/**
 * Base docker services configuration.
 * Ports are offset based on environment (command-center = 0, worktrees = portIndex * 10)
 *
 * taskPrefix: Overrides the default task prefix ({id}:local:) for services
 *             whose tasks are defined in a different Taskfile.
 */
export const DOCKER_SERVICES_CONFIG: DockerServiceConfig[] = [
  {
    id: 'frontend',
    name: 'Frontend',
    icon: 'web',
    basePort: 3000,
    internalPort: 8080,
    browserPath: '/',
  },
  {
    id: 'backend',
    name: 'Backend',
    icon: 'dns',
    basePort: 8085,
    internalPort: 8080,
    healthEndpoint: '/health',
  },
  {
    id: 'database',
    name: 'Database',
    icon: 'storage',
    basePort: 5437,
    internalPort: 5432,
    browserPort: 8082, // Opens pgweb for database management
    browserPath: '/',
  },
  {
    id: 'keycloak',
    name: 'Keycloak',
    icon: 'security',
    basePort: 8081,
    internalPort: 8080,
  },
];

/**
 * Compute docker services with environment-specific port offsets
 */
export function computeDockerServices(portOffset: number = 0): DockerService[] {
  return DOCKER_SERVICES_CONFIG.map((config) => {
    const port = config.basePort > 0 ? config.basePort + portOffset : undefined;
    const url = port
      ? `http://localhost:${port}${config.urlPath || ''}`
      : undefined;

    // Browser URL: use browserPort if specified, otherwise use basePort with browserPath
    let browserUrl: string | undefined;
    if (config.browserPort) {
      browserUrl = `http://localhost:${config.browserPort + portOffset}${config.browserPath || ''}`;
    } else if (config.browserPath !== undefined) {
      browserUrl = port ? `http://localhost:${port}${config.browserPath}` : undefined;
    }

    return {
      ...config,
      port,
      url,
      browserUrl,
    };
  });
}

/**
 * Get a specific service by ID
 */
export function getServiceById(
  services: DockerService[],
  id: string
): DockerService | undefined {
  return services.find((s) => s.id === id);
}
