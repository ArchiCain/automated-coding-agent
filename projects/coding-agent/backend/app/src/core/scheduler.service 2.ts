import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TaskIntakeService } from './task-intake.service';
import { EnvironmentManagerService } from './environment-manager.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly taskIntake: TaskIntakeService,
    private readonly environmentManager: EnvironmentManagerService,
  ) {}

  /**
   * Clean up stale environments every hour.
   * Environments that have been idle for too long get destroyed.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupStaleEnvironments(): Promise<void> {
    this.logger.debug('Running stale environment cleanup');

    const environments = this.environmentManager.getTrackedEnvironments();
    for (const env of environments) {
      try {
        const health = await this.environmentManager.checkHealth(env.taskId);
        if (!health.healthy) {
          this.logger.warn(
            `Environment for task ${env.taskId} is unhealthy, consider cleanup`,
          );
          // TODO: Auto-destroy after configurable idle threshold
        }
      } catch (err) {
        this.logger.error(
          `Health check failed for ${env.taskId}: ${(err as Error).message}`,
        );
      }
    }
  }

  /**
   * Poll GitHub issues every 5 minutes for new work.
   */
  @Cron('0 */5 * * * *')
  async pollGitHubIssues(): Promise<void> {
    this.logger.debug('Polling GitHub issues for new tasks');

    try {
      await this.taskIntake.pollGitHubIssues();
    } catch (err) {
      this.logger.error(
        `GitHub polling failed: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Sync history and metrics every 15 minutes.
   */
  @Cron('0 */15 * * * *')
  async syncHistory(): Promise<void> {
    this.logger.debug('Syncing history (stub)');
    // TODO: Persist completed task history to disk/database,
    // aggregate cost metrics, and sync with git-based memory.
  }
}
