import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Task } from '../core/interfaces/task.interface';

export interface RoleResult {
  role: string;
  action: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  cost: number;
  transcriptPath?: string;
}

@Injectable()
export class TaskSummaryService {
  private readonly logger = new Logger(TaskSummaryService.name);
  private readonly historyRoot: string;

  constructor() {
    const repoRoot = process.env.REPO_ROOT || process.cwd();
    this.historyRoot = path.join(repoRoot, '.the-dev-team', 'history');
  }

  async generate(task: Task, roleResults: RoleResult[]): Promise<string> {
    const now = new Date();
    const monthDir = path.join(
      this.historyRoot,
      'tasks',
      now.getFullYear().toString(),
      String(now.getMonth() + 1).padStart(2, '0'),
    );
    await fs.mkdir(monthDir, { recursive: true });

    const slug = task.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);

    const filename = `task-${task.id}-${slug}.md`;
    const filepath = path.join(monthDir, filename);

    const summary = this.buildSummary(task, roleResults);
    await fs.writeFile(filepath, summary, 'utf-8');

    await this.appendToIndex(task, roleResults);

    this.logger.log(`Generated task summary at ${filepath}`);
    return filepath;
  }

  private buildSummary(task: Task, roleResults: RoleResult[]): string {
    const totalCost = roleResults.reduce((sum, r) => sum + r.cost, 0);
    const totalDuration = task.completedAt && task.startedAt
      ? new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime()
      : 0;
    const durationStr = totalDuration > 0
      ? `${Math.round(totalDuration / 1000)}s`
      : 'N/A';

    let md = `# Task Summary: ${task.title}\n\n`;
    md += `| Field | Value |\n`;
    md += `|-------|-------|\n`;
    md += `| Task ID | \`${task.id}\` |\n`;
    md += `| Title | ${task.title} |\n`;
    md += `| Status | ${task.status} |\n`;
    md += `| Branch | \`${task.branch}\` |\n`;
    md += `| PR | ${task.prNumber ? `#${task.prNumber}` : 'N/A'} |\n`;
    md += `| Duration | ${durationStr} |\n`;
    md += `| Total Cost | $${totalCost.toFixed(4)} |\n`;
    md += `\n`;

    // Timeline table
    md += `## Timeline\n\n`;
    md += `| Time | Role | Action | Duration | Cost |\n`;
    md += `|------|------|--------|----------|------|\n`;
    for (const r of roleResults) {
      const dur = r.durationMs > 0 ? `${Math.round(r.durationMs / 1000)}s` : 'N/A';
      md += `| ${r.startedAt} | ${r.role} | ${r.action} | ${dur} | $${r.cost.toFixed(4)} |\n`;
    }
    md += `\n`;

    // Validation gates table
    if (task.gateResults && task.gateResults.length > 0) {
      md += `## Validation Gates\n\n`;
      md += `| Gate | Result | Attempts | Notes |\n`;
      md += `|------|--------|----------|-------|\n`;
      for (const g of task.gateResults) {
        md += `| ${g.gate} | ${g.passed ? 'PASS' : 'FAIL'} | ${g.attempt} | ${g.notes || '-'} |\n`;
      }
      md += `\n`;
    }

    // Files changed
    if (task.changedFiles && task.changedFiles.length > 0) {
      md += `## Files Changed\n\n`;
      for (const file of task.changedFiles) {
        md += `- \`${file}\`\n`;
      }
      md += `\n`;
    }

    // Session transcript links
    const transcripts = roleResults.filter(r => r.transcriptPath);
    if (transcripts.length > 0) {
      md += `## Session Transcripts\n\n`;
      for (const r of transcripts) {
        md += `- **${r.role}**: \`${r.transcriptPath}\`\n`;
      }
      md += `\n`;
    }

    return md;
  }

  private async appendToIndex(task: Task, roleResults: RoleResult[]): Promise<void> {
    const indexPath = path.join(this.historyRoot, 'tasks', 'index.jsonl');
    const totalCost = roleResults.reduce((sum, r) => sum + r.cost, 0);

    const entry = {
      taskId: task.id,
      title: task.title,
      status: task.status,
      branch: task.branch,
      prNumber: task.prNumber,
      source: task.source,
      cost: totalCost,
      rolesInvolved: roleResults.map(r => r.role),
      completedAt: new Date().toISOString(),
    };

    await fs.appendFile(indexPath, JSON.stringify(entry) + '\n', 'utf-8');
  }
}
