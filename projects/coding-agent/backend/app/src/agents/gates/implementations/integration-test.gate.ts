import { Logger } from '@nestjs/common';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { ValidationGate, GateContext, GateResult } from '../gate.interface';

const execFile = promisify(execFileCb);

export class IntegrationTestGate implements ValidationGate {
  readonly name = 'integration-tests';
  readonly description = 'Runs integration tests against the deployed sandbox';
  readonly phase = 2 as const;
  readonly applicableTo = 'all' as const;

  private readonly logger = new Logger(IntegrationTestGate.name);

  async run(context: GateContext): Promise<GateResult> {
    const start = Date.now();
    const results: string[] = [];
    let allPassed = true;

    // Run backend integration tests
    const backendAppDir = path.join(
      context.worktreePath,
      'projects',
      'coding-agent',
      'backend',
      'app',
    );

    try {
      const hasIntegrationConfig = fs.existsSync(
        path.join(backendAppDir, 'jest.integration.config.js'),
      ) || fs.existsSync(
        path.join(backendAppDir, 'jest.integration.config.ts'),
      );

      if (!hasIntegrationConfig) {
        // Check if test:integration script exists in package.json
        const hasScript = await this.hasNpmScript(backendAppDir, 'test:integration');

        if (!hasScript) {
          return {
            gate: this.name,
            passed: true,
            output:
              'No integration test configuration found (no jest.integration.config.* and no test:integration script). Passing with note.',
            details: { skipped: true, reason: 'no integration test config' },
            durationMs: Date.now() - start,
            attempt: 1,
          };
        }
      }

      this.logger.log(
        `Running backend integration tests for task ${context.taskId}`,
      );

      const hasScript = await this.hasNpmScript(backendAppDir, 'test:integration');
      const cmd = hasScript
        ? { bin: 'npm', args: ['run', 'test:integration'] }
        : {
            bin: 'npx',
            args: ['jest', '--config', 'jest.integration.config.js', '--forceExit'],
          };

      const { stdout, stderr } = await execFile(cmd.bin, cmd.args, {
        cwd: backendAppDir,
        timeout: 600_000,
        maxBuffer: 1024 * 1024 * 10,
      });

      results.push(`[Backend Integration Tests]\n${stdout}`);
      if (stderr) results.push(`[Backend Stderr]\n${stderr}`);
    } catch (err) {
      allPassed = false;
      const error = err as Error & { stdout?: string; stderr?: string };
      results.push(
        `[Backend Integration Tests - FAILED]\n${error.stdout || ''}\n${error.stderr || ''}\n${error.message}`,
      );
    }

    // Run frontend integration tests if applicable
    if (context.touchesFrontend) {
      const frontendDir = path.join(
        context.worktreePath,
        'projects',
        'coding-agent',
        'frontend',
      );

      try {
        const hasScript = await this.hasNpmScript(frontendDir, 'test:integration');
        if (hasScript) {
          this.logger.log(
            `Running frontend integration tests for task ${context.taskId}`,
          );

          const { stdout, stderr } = await execFile(
            'npm',
            ['run', 'test:integration'],
            {
              cwd: frontendDir,
              timeout: 600_000,
              maxBuffer: 1024 * 1024 * 10,
            },
          );

          results.push(`[Frontend Integration Tests]\n${stdout}`);
          if (stderr) results.push(`[Frontend Stderr]\n${stderr}`);
        } else {
          results.push(
            '[Frontend Integration Tests] No test:integration script found — skipped',
          );
        }
      } catch (err) {
        allPassed = false;
        const error = err as Error & { stdout?: string; stderr?: string };
        results.push(
          `[Frontend Integration Tests - FAILED]\n${error.stdout || ''}\n${error.stderr || ''}\n${error.message}`,
        );
      }
    }

    const output = results.join('\n\n');
    const testCounts = this.parseTestCounts(output);

    return {
      gate: this.name,
      passed: allPassed,
      output,
      details: testCounts,
      durationMs: Date.now() - start,
      attempt: 1,
    };
  }

  private async hasNpmScript(dir: string, scriptName: string): Promise<boolean> {
    try {
      const pkgPath = path.join(dir, 'package.json');
      const raw = fs.readFileSync(pkgPath, 'utf-8');
      const pkg = JSON.parse(raw);
      return !!(pkg.scripts && pkg.scripts[scriptName]);
    } catch {
      return false;
    }
  }

  private parseTestCounts(output: string): Record<string, unknown> {
    const counts: Record<string, unknown> = {};

    const passedMatch = output.match(/Tests:\s*(\d+)\s*passed/);
    const failedMatch = output.match(/Tests:\s*(\d+)\s*failed/);
    const totalMatch = output.match(/Tests:\s*(\d+)\s*total/);

    if (passedMatch) counts.passed = parseInt(passedMatch[1], 10);
    if (failedMatch) counts.failed = parseInt(failedMatch[1], 10);
    if (totalMatch) counts.total = parseInt(totalMatch[1], 10);

    return counts;
  }
}
