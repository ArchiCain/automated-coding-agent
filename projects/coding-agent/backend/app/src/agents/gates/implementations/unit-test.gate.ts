import { Logger } from '@nestjs/common';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { ValidationGate, GateContext, GateResult } from '../gate.interface';

const execFile = promisify(execFileCb);

export class UnitTestGate implements ValidationGate {
  readonly name = 'unit-tests';
  readonly description = 'Runs npm test in backend (and frontend if applicable)';
  readonly phase = 1 as const;
  readonly applicableTo = 'all' as const;

  private readonly logger = new Logger(UnitTestGate.name);

  async run(context: GateContext): Promise<GateResult> {
    const start = Date.now();
    const results: string[] = [];
    let allPassed = true;

    // Run backend tests
    try {
      this.logger.log(`Running backend unit tests for task ${context.taskId}`);
      const backendDir = path.join(context.worktreePath, 'projects', 'coding-agent', 'backend');
      const { stdout, stderr } = await execFile('npm', ['test'], {
        cwd: backendDir,
        timeout: 300_000,
        maxBuffer: 1024 * 1024 * 10,
      });
      results.push(`[Backend Tests]\n${stdout}`);
      if (stderr) results.push(`[Backend Stderr]\n${stderr}`);
    } catch (err) {
      allPassed = false;
      const error = err as Error & { stdout?: string; stderr?: string };
      results.push(`[Backend Tests - FAILED]\n${error.stdout || ''}\n${error.stderr || ''}\n${error.message}`);
    }

    // Run frontend tests if applicable
    if (context.touchesFrontend) {
      try {
        this.logger.log(`Running frontend unit tests for task ${context.taskId}`);
        const frontendDir = path.join(context.worktreePath, 'projects', 'coding-agent', 'frontend');
        const { stdout, stderr } = await execFile('npm', ['test'], {
          cwd: frontendDir,
          timeout: 300_000,
          maxBuffer: 1024 * 1024 * 10,
        });
        results.push(`[Frontend Tests]\n${stdout}`);
        if (stderr) results.push(`[Frontend Stderr]\n${stderr}`);
      } catch (err) {
        allPassed = false;
        const error = err as Error & { stdout?: string; stderr?: string };
        results.push(`[Frontend Tests - FAILED]\n${error.stdout || ''}\n${error.stderr || ''}\n${error.message}`);
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

  private parseTestCounts(output: string): Record<string, unknown> {
    const counts: Record<string, unknown> = {};

    // Try to parse Jest-style output
    const passedMatch = output.match(/Tests:\s*(\d+)\s*passed/);
    const failedMatch = output.match(/Tests:\s*(\d+)\s*failed/);
    const totalMatch = output.match(/Tests:\s*(\d+)\s*total/);

    if (passedMatch) counts.passed = parseInt(passedMatch[1], 10);
    if (failedMatch) counts.failed = parseInt(failedMatch[1], 10);
    if (totalMatch) counts.total = parseInt(totalMatch[1], 10);

    return counts;
  }
}
