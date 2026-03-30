import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { DockerStatusMap, DockerContainerStatus } from '../models/docker-service.model';

interface DockerPsOutput {
  Name: string;
  State: string;
  Health: string;
  Service: string;
}

/**
 * Service for interacting with docker environment.
 * Provides methods to get container status.
 */
@Injectable({
  providedIn: 'root',
})
export class LocalEnvService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/command-center`;

  /**
   * Get Docker container status for all services
   */
  getDockerStatus(): Observable<DockerStatusMap> {
    return this.http
      .get<{ status: DockerPsOutput[] }>(`${this.baseUrl}/docker/status`)
      .pipe(
        map((response) => this.parseDockerStatus(response.status)),
        catchError((error) => {
          console.error('Failed to get docker status:', error);
          return of({});
        })
      );
  }

  /**
   * Parse docker compose ps output into a status map
   */
  private parseDockerStatus(containers: DockerPsOutput[]): DockerStatusMap {
    const statusMap: DockerStatusMap = {};

    for (const container of containers) {
      const serviceId = container.Service || this.extractServiceId(container.Name);
      if (!serviceId) continue;

      statusMap[serviceId] = {
        state: this.parseState(container.State),
        health: this.parseHealth(container.Health),
      };
    }

    return statusMap;
  }

  /**
   * Extract service ID from container name
   * Container names are typically: {project}_{service}_{index}
   */
  private extractServiceId(name: string): string {
    const parts = name.split(/[-_]/);
    // Return the second-to-last part (service name)
    return parts.length >= 2 ? parts[parts.length - 2] : name;
  }

  /**
   * Parse container state string
   */
  private parseState(
    state: string
  ): DockerContainerStatus['state'] {
    const normalized = state?.toLowerCase() || '';
    if (normalized.includes('running')) return 'running';
    if (normalized.includes('exited')) return 'exited';
    if (normalized.includes('dead')) return 'dead';
    if (normalized.includes('restarting')) return 'restarting';
    if (normalized.includes('created')) return 'created';
    return 'unknown';
  }

  /**
   * Parse health status string
   */
  private parseHealth(health: string): DockerContainerStatus['health'] {
    const normalized = health?.toLowerCase() || '';
    if (normalized.includes('healthy')) return 'healthy';
    if (normalized.includes('unhealthy')) return 'unhealthy';
    if (normalized.includes('starting')) return 'starting';
    return null;
  }
}
