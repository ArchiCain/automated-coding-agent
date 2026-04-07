import { Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ValidationGate, GateContext, GateResult } from '../gate.interface';

export class DesignReviewGate implements ValidationGate {
  readonly name = 'design-review';
  readonly description = 'Reads designer findings and checks for blocking issues';
  readonly phase = 2 as const;
  readonly applicableTo = 'frontend' as const;

  private readonly logger = new Logger(DesignReviewGate.name);

  async run(context: GateContext): Promise<GateResult> {
    const start = Date.now();

    try {
      const findingsPath = path.join(
        context.worktreePath,
        '.the-dev-team',
        'state',
        context.taskId,
        'findings',
        'designer.md',
      );

      this.logger.log(`Reading designer findings from ${findingsPath}`);

      let content: string;
      try {
        content = await fs.readFile(findingsPath, 'utf-8');
      } catch {
        // No findings file means designer hasn't run or found no issues
        return {
          gate: this.name,
          passed: true,
          output: 'No designer findings file found — skipping (no blocking issues)',
          details: { skipped: true },
          durationMs: Date.now() - start,
          attempt: 1,
        };
      }

      const hasBlockingIssues = this.checkForBlockingIssues(content);

      if (hasBlockingIssues) {
        this.logger.warn(
          `Design review gate found blocking issues for task ${context.taskId}`,
        );
      }

      return {
        gate: this.name,
        passed: !hasBlockingIssues,
        output: hasBlockingIssues
          ? `Blocking design issues found:\n\n${this.extractBlockingSection(content)}`
          : 'No blocking design issues found',
        details: { hasBlockingIssues, findingsPath },
        durationMs: Date.now() - start,
        attempt: 1,
      };
    } catch (err) {
      const error = err as Error;
      this.logger.warn(`Design review gate error for task ${context.taskId}: ${error.message}`);

      return {
        gate: this.name,
        passed: false,
        output: `Design review gate error: ${error.message}`,
        details: { error: error.message },
        durationMs: Date.now() - start,
        attempt: 1,
      };
    }
  }

  private checkForBlockingIssues(content: string): boolean {
    // Find the "## Blocking Issues" section
    const blockingMatch = content.match(/## Blocking Issues\s*\n([\s\S]*?)(?=\n## |\n$|$)/);
    if (!blockingMatch) return false;

    const blockingContent = blockingMatch[1].trim();
    // Empty section or only whitespace means no blocking issues
    if (!blockingContent) return false;

    // Check if the content is just "None" or similar
    if (/^(none|n\/a|no blocking issues|—|-)\s*$/i.test(blockingContent)) {
      return false;
    }

    return true;
  }

  private extractBlockingSection(content: string): string {
    const blockingMatch = content.match(/## Blocking Issues\s*\n([\s\S]*?)(?=\n## |\n$|$)/);
    return blockingMatch ? blockingMatch[1].trim() : '';
  }
}
