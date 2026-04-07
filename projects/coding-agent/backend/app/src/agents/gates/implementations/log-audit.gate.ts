import { Logger } from '@nestjs/common';
import { ValidationGate, GateContext, GateResult } from '../gate.interface';
import { TaskfileService } from '../../../shared/taskfile.service';

export class LogAuditGate implements ValidationGate {
  readonly name = 'log-audit';
  readonly description = 'Runs env:logs:errors via Taskfile and checks for errors in application logs';
  readonly phase = 1 as const;
  readonly applicableTo = 'all' as const;

  private readonly logger = new Logger(LogAuditGate.name);

  constructor(private readonly taskfileService: TaskfileService) {}

  async run(context: GateContext): Promise<GateResult> {
    const start = Date.now();

    try {
      this.logger.log(`Running log audit for task ${context.taskId}`);

      const { stdout, stderr } = await this.taskfileService.run('env:logs:errors', [], {
        cwd: context.worktreePath,
        timeout: 60_000,
      });

      const output = [stdout, stderr].filter(Boolean).join('\n').trim();
      const hasErrors = output.length > 0 && !output.match(/^No errors found\.?\s*$/i);

      return {
        gate: this.name,
        passed: !hasErrors,
        output: output || 'No errors found',
        details: { errorsFound: hasErrors },
        durationMs: Date.now() - start,
        attempt: 1,
      };
    } catch (err) {
      const error = err as Error & { stdout?: string; stderr?: string };
      const output = [error.stdout, error.stderr, error.message]
        .filter(Boolean)
        .join('\n');

      // If the command fails because there are no error logs, that is a pass
      if (output.includes('No errors found') || output.includes('no matching entries')) {
        return {
          gate: this.name,
          passed: true,
          output: 'No errors found in logs',
          durationMs: Date.now() - start,
          attempt: 1,
        };
      }

      this.logger.warn(`Log audit gate failed for task ${context.taskId}: ${error.message}`);

      return {
        gate: this.name,
        passed: false,
        output: output || 'Log audit failed',
        details: { error: error.message },
        durationMs: Date.now() - start,
        attempt: 1,
      };
    }
  }
}
