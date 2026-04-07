import { Logger } from '@nestjs/common';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { ValidationGate, GateContext, GateResult } from '../gate.interface';

const execFile = promisify(execFileCb);

interface PlaywrightJsonReport {
  suites?: PlaywrightSuite[];
  stats?: {
    expected?: number;
    unexpected?: number;
    flaky?: number;
    skipped?: number;
    duration?: number;
  };
}

interface PlaywrightSuite {
  title?: string;
  specs?: Array<{
    title?: string;
    ok?: boolean;
    tests?: Array<{
      status?: string;
      results?: Array<{ status?: string }>;
    }>;
  }>;
  suites?: PlaywrightSuite[];
}

export class E2ETestGate implements ValidationGate {
  readonly name = 'e2e-tests';
  readonly description = 'Runs Playwright end-to-end tests against the sandbox environment';
  readonly phase = 2 as const;
  readonly applicableTo = 'all' as const;

  private readonly logger = new Logger(E2ETestGate.name);

  async run(context: GateContext): Promise<GateResult> {
    const start = Date.now();

    try {
      this.logger.log(`Running E2E tests for task ${context.taskId}`);

      const e2eDir = path.join(context.worktreePath, 'projects', 'coding-agent', 'e2e');
      const baseUrl = `http://localhost:${context.namespace ? '3000' : '3000'}`;

      const { stdout, stderr } = await execFile(
        'npx',
        ['playwright', 'test', '--reporter=json'],
        {
          cwd: e2eDir,
          timeout: 600_000,
          maxBuffer: 1024 * 1024 * 50,
          env: {
            ...process.env,
            BASE_URL: baseUrl,
          },
        },
      );

      const report = this.parseJsonReport(stdout);
      const passed = report.stats
        ? (report.stats.unexpected ?? 0) === 0
        : true;

      const summary = report.stats
        ? `Passed: ${report.stats.expected ?? 0}, Failed: ${report.stats.unexpected ?? 0}, Flaky: ${report.stats.flaky ?? 0}, Skipped: ${report.stats.skipped ?? 0}`
        : 'Tests completed';

      return {
        gate: this.name,
        passed,
        output: `${summary}\n\n${stderr || ''}`.trim(),
        details: {
          stats: report.stats,
        },
        durationMs: Date.now() - start,
        attempt: 1,
      };
    } catch (err) {
      const error = err as Error & { stdout?: string; stderr?: string };
      const output = [error.stdout, error.stderr, error.message]
        .filter(Boolean)
        .join('\n');

      // Attempt to parse JSON from stdout even on failure (Playwright exits non-zero on test failures)
      const report = this.parseJsonReport(error.stdout || '');
      const stats = report.stats;

      this.logger.warn(`E2E test gate failed for task ${context.taskId}: ${error.message}`);

      return {
        gate: this.name,
        passed: false,
        output: stats
          ? `Failed: ${stats.unexpected ?? '?'}, Passed: ${stats.expected ?? '?'}\n\n${output}`
          : output || 'E2E tests failed',
        details: { stats, error: error.message },
        durationMs: Date.now() - start,
        attempt: 1,
      };
    }
  }

  private parseJsonReport(output: string): PlaywrightJsonReport {
    try {
      // Playwright JSON reporter outputs the full report to stdout
      const jsonStart = output.indexOf('{');
      if (jsonStart === -1) return {};
      return JSON.parse(output.slice(jsonStart)) as PlaywrightJsonReport;
    } catch {
      return {};
    }
  }
}
