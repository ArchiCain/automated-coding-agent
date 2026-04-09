import { Injectable, Logger } from '@nestjs/common';
import { TaskfileService } from '../shared/taskfile.service';

export interface EnvironmentInfo {
  taskId: string;
  status: string;
  services?: Record<string, { healthy: boolean; detail: string }>;
}

@Injectable()
export class EnvironmentManagerService {
  private readonly logger = new Logger(EnvironmentManagerService.name);
  private readonly environments = new Map<string, EnvironmentInfo>();

  constructor(private readonly taskfileService: TaskfileService) {}

  async createEnvironment(
    taskId: string,
    imageTag?: string,
  ): Promise<EnvironmentInfo> {
    this.logger.log(`Creating environment for task ${taskId}`);

    const args: string[] = [];
    if (imageTag) {
      args.push(`--`, `IMAGE_TAG=${imageTag}`);
    }

    try {
      await this.taskfileService.run('env:create', [taskId, ...args]);

      const info: EnvironmentInfo = {
        taskId,
        status: 'running',
      };
      this.environments.set(taskId, info);
      return info;
    } catch (err) {
      this.logger.error(
        `Failed to create environment for ${taskId}: ${(err as Error).message}`,
      );
      const info: EnvironmentInfo = {
        taskId,
        status: 'error',
      };
      this.environments.set(taskId, info);
      throw err;
    }
  }

  async destroyEnvironment(taskId: string): Promise<void> {
    this.logger.log(`Destroying environment for task ${taskId}`);

    try {
      await this.taskfileService.run('env:destroy', [taskId]);
    } catch (err) {
      this.logger.warn(
        `Environment destroy may have partially failed for ${taskId}: ${(err as Error).message}`,
      );
    }

    this.environments.delete(taskId);
  }

  async checkHealth(
    taskId: string,
  ): Promise<{ healthy: boolean; services: Record<string, { healthy: boolean; detail: string }> }> {
    this.logger.debug(`Checking health for environment ${taskId}`);

    try {
      const result = await this.taskfileService.run('env:health', [taskId]);
      // Parse health check output
      const healthy = !result.stdout.includes('unhealthy');
      return {
        healthy,
        services: {
          app: {
            healthy,
            detail: result.stdout.trim() || 'Health check completed',
          },
        },
      };
    } catch (err) {
      return {
        healthy: false,
        services: {
          app: {
            healthy: false,
            detail: (err as Error).message,
          },
        },
      };
    }
  }

  async getLogs(taskId: string, service?: string): Promise<string> {
    this.logger.debug(`Fetching logs for ${taskId}${service ? `:${service}` : ''}`);

    const args = [taskId];
    if (service) {
      args.push(service);
    }

    try {
      const result = await this.taskfileService.run('env:logs', args);
      return result.stdout;
    } catch (err) {
      return `Failed to fetch logs: ${(err as Error).message}`;
    }
  }

  getTrackedEnvironments(): EnvironmentInfo[] {
    return Array.from(this.environments.values());
  }
}
