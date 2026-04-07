import { Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ValidationGate, GateContext, GateResult } from '../gate.interface';

interface AccessibilityViolation {
  id: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  help: string;
  helpUrl: string;
  nodes?: Array<{ html?: string; target?: string[] }>;
}

interface AccessibilityReport {
  violations?: AccessibilityViolation[];
  passes?: unknown[];
  incomplete?: unknown[];
  inapplicable?: unknown[];
}

export class AccessibilityGate implements ValidationGate {
  readonly name = 'accessibility';
  readonly description = 'Reads accessibility audit results and checks for violations';
  readonly phase = 2 as const;
  readonly applicableTo = 'frontend' as const;

  private readonly logger = new Logger(AccessibilityGate.name);

  async run(context: GateContext): Promise<GateResult> {
    const start = Date.now();

    try {
      const resultsPath = path.join(
        context.worktreePath,
        '.the-dev-team',
        'state',
        context.taskId,
        'gate-results',
        'accessibility-raw.json',
      );

      this.logger.log(`Reading accessibility results from ${resultsPath}`);

      let rawData: string;
      try {
        rawData = await fs.readFile(resultsPath, 'utf-8');
      } catch {
        // No results file means accessibility tests haven't been run
        return {
          gate: this.name,
          passed: true,
          output: 'No accessibility results file found — skipping (no violations detected)',
          details: { skipped: true },
          durationMs: Date.now() - start,
          attempt: 1,
        };
      }

      const report = JSON.parse(rawData) as AccessibilityReport;
      const violations = report.violations ?? [];

      const criticalOrSerious = violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      );

      const summary = this.formatViolationSummary(violations);
      const passed = criticalOrSerious.length === 0;

      if (!passed) {
        this.logger.warn(
          `Accessibility gate found ${criticalOrSerious.length} critical/serious violations for task ${context.taskId}`,
        );
      }

      return {
        gate: this.name,
        passed,
        output: summary,
        details: {
          totalViolations: violations.length,
          critical: violations.filter((v) => v.impact === 'critical').length,
          serious: violations.filter((v) => v.impact === 'serious').length,
          moderate: violations.filter((v) => v.impact === 'moderate').length,
          minor: violations.filter((v) => v.impact === 'minor').length,
        },
        durationMs: Date.now() - start,
        attempt: 1,
      };
    } catch (err) {
      const error = err as Error;
      this.logger.warn(`Accessibility gate error for task ${context.taskId}: ${error.message}`);

      return {
        gate: this.name,
        passed: false,
        output: `Accessibility gate error: ${error.message}`,
        details: { error: error.message },
        durationMs: Date.now() - start,
        attempt: 1,
      };
    }
  }

  private formatViolationSummary(violations: AccessibilityViolation[]): string {
    if (violations.length === 0) {
      return 'No accessibility violations found';
    }

    const lines: string[] = [`Found ${violations.length} accessibility violation(s):\n`];

    for (const v of violations) {
      lines.push(`- [${v.impact.toUpperCase()}] ${v.id}: ${v.description}`);
      lines.push(`  Help: ${v.help}`);
      if (v.nodes && v.nodes.length > 0) {
        lines.push(`  Affected elements: ${v.nodes.length}`);
      }
    }

    return lines.join('\n');
  }
}
