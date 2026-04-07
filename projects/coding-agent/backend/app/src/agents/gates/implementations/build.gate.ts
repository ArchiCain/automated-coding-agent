import { Logger } from '@nestjs/common';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { ValidationGate, GateContext, GateResult } from '../gate.interface';
import { TaskfileService } from '../../../shared/taskfile.service';

const execFile = promisify(execFileCb);

export class BuildGate implements ValidationGate {
  readonly name = 'build';
  readonly description = 'Runs build and verifies no errors (local: npm run build, sandbox: env:build via Taskfile)';
  readonly phase = 1 as const;
  readonly applicableTo = 'all' as const;

  private readonly logger = new Logger(BuildGate.name);

  constructor(private readonly taskfileService: TaskfileService) {}

  async run(context: GateContext): Promise<GateResult> {
    const start = Date.now();

    if (context.executionMode === 'local') {
      return this.runLocal(context, start);
    }
    return this.runSandbox(context, start);
  }

  /**
   * Local mode: run `npm run build` directly in the worktree's backend app directory.
   */
  private async runLocal(context: GateContext, start: number): Promise<GateResult> {
    try {
      this.logger.log(`Running local build gate for task ${context.taskId}`);

      const backendAppDir = path.join(
        context.worktreePath,
        'projects',
        'coding-agent',
        'backend',
        'app',
      );

      const { stdout, stderr } = await execFile('npm', ['run', 'build'], {
        cwd: backendAppDir,
        timeout: 600_000,
        maxBuffer: 1024 * 1024 * 10,
      });

      const output = [stdout, stderr].filter(Boolean).join('\n');

      return {
        gate: this.name,
        passed: true,
        output: output || 'Local build completed successfully',
        durationMs: Date.now() - start,
        attempt: 1,
      };
    } catch (err) {
      const error = err as Error & { stdout?: string; stderr?: string };
      const output = [error.stdout, error.stderr, error.message]
        .filter(Boolean)
        .join('\n');

      this.logger.warn(`Local build gate failed for task ${context.taskId}: ${error.message}`);

      return {
        gate: this.name,
        passed: false,
        output: output || 'Local build failed with unknown error',
        details: { error: error.message },
        durationMs: Date.now() - start,
        attempt: 1,
      };
    }
  }

  /**
   * Sandbox mode: run env:build via Taskfile (requires K8s).
   */
  private async runSandbox(context: GateContext, start: number): Promise<GateResult> {
    try {
      this.logger.log(`Running sandbox build gate for task ${context.taskId}`);

      const { stdout, stderr } = await this.taskfileService.run('env:build', [], {
        cwd: context.worktreePath,
        timeout: 600_000,
      });

      const output = [stdout, stderr].filter(Boolean).join('\n');

      return {
        gate: this.name,
        passed: true,
        output: output || 'Build completed successfully',
        durationMs: Date.now() - start,
        attempt: 1,
      };
    } catch (err) {
      const error = err as Error & { stdout?: string; stderr?: string };
      const output = [error.stdout, error.stderr, error.message]
        .filter(Boolean)
        .join('\n');

      this.logger.warn(`Build gate failed for task ${context.taskId}: ${error.message}`);

      return {
        gate: this.name,
        passed: false,
        output: output || 'Build failed with unknown error',
        details: { error: error.message },
        durationMs: Date.now() - start,
        attempt: 1,
      };
    }
  }
}
