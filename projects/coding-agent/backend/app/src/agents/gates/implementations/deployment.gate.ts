import { Logger } from '@nestjs/common';
import { ValidationGate, GateContext, GateResult } from '../gate.interface';
import { TaskfileService } from '../../../shared/taskfile.service';

export class DeploymentGate implements ValidationGate {
  readonly name = 'deployment';
  readonly description = 'Runs env:health via Taskfile and checks for unhealthy services';
  readonly phase = 1 as const;
  readonly applicableTo = 'all' as const;

  private readonly logger = new Logger(DeploymentGate.name);

  constructor(private readonly taskfileService: TaskfileService) {}

  async run(context: GateContext): Promise<GateResult> {
    const start = Date.now();

    // In local mode, skip deployment health check (no sandbox to check)
    if (context.executionMode === 'local') {
      this.logger.log(`Skipping deployment gate in local mode for task ${context.taskId}`);
      return {
        gate: this.name,
        passed: true,
        output: 'Deployment gate skipped in local mode (no sandbox environment)',
        details: { skipped: true, reason: 'local mode' },
        durationMs: Date.now() - start,
        attempt: 1,
      };
    }

    try {
      this.logger.log(`Running deployment health check for task ${context.taskId}`);

      const { stdout, stderr } = await this.taskfileService.run('env:health', [], {
        cwd: context.worktreePath,
        timeout: 120_000,
      });

      const output = [stdout, stderr].filter(Boolean).join('\n');
      const hasUnhealthy = output.toUpperCase().includes('UNHEALTHY');

      if (hasUnhealthy) {
        this.logger.warn(`Deployment gate found unhealthy services for task ${context.taskId}`);
      }

      return {
        gate: this.name,
        passed: !hasUnhealthy,
        output: output || 'Health check completed',
        details: { unhealthyDetected: hasUnhealthy },
        durationMs: Date.now() - start,
        attempt: 1,
      };
    } catch (err) {
      const error = err as Error & { stdout?: string; stderr?: string };
      const output = [error.stdout, error.stderr, error.message]
        .filter(Boolean)
        .join('\n');

      this.logger.warn(`Deployment gate failed for task ${context.taskId}: ${error.message}`);

      return {
        gate: this.name,
        passed: false,
        output: output || 'Health check failed',
        details: { error: error.message },
        durationMs: Date.now() - start,
        attempt: 1,
      };
    }
  }
}
