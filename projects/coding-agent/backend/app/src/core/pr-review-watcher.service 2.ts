import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import { TaskIntakeService } from './task-intake.service';

const execFile = promisify(execFileCb);

interface BotPR {
  number: number;
  title: string;
  headRefName: string;
}

interface PRComment {
  id: number;
  body: string;
  user: { login: string };
  path?: string;
  created_at: string;
}

@Injectable()
export class PRReviewWatcherService {
  private readonly logger = new Logger(PRReviewWatcherService.name);
  private readonly repoRoot: string;
  private readonly processedCommentIds = new Set<number>();

  constructor(private readonly taskIntake: TaskIntakeService) {
    this.repoRoot = process.env.REPO_ROOT || process.cwd();
  }

  @Cron('*/2 * * * *')
  async checkForReviewComments(): Promise<void> {
    this.logger.debug('Checking for PR review comments');

    try {
      const prs = await this.getOpenBotPRs();
      if (prs.length === 0) return;

      for (const pr of prs) {
        const comments = await this.getUnprocessedComments(pr.number);
        if (comments.length > 0) {
          this.logger.log(
            `Found ${comments.length} unprocessed comments on PR #${pr.number}`,
          );
          await this.createReworkTask(pr, comments);

          // Mark all comments as processed
          for (const comment of comments) {
            this.processedCommentIds.add(comment.id);
          }
        }
      }
    } catch (err) {
      this.logger.error(
        `Error checking review comments: ${(err as Error).message}`,
      );
    }
  }

  @Cron('*/5 * * * *')
  async checkForApprovals(): Promise<void> {
    this.logger.debug('Checking for PR approvals');

    try {
      const prs = await this.getOpenBotPRs();

      for (const pr of prs) {
        const { stdout } = await execFile(
          'gh',
          [
            'pr',
            'view',
            String(pr.number),
            '--json',
            'reviewDecision',
          ],
          { cwd: this.repoRoot },
        );

        const data = JSON.parse(stdout);
        if (data.reviewDecision === 'APPROVED') {
          this.logger.log(`PR #${pr.number} has been approved`);
          // Approval handling can trigger cleanup or merge workflows
        }
      }
    } catch (err) {
      this.logger.error(
        `Error checking approvals: ${(err as Error).message}`,
      );
    }
  }

  async getOpenBotPRs(): Promise<BotPR[]> {
    try {
      const { stdout } = await execFile(
        'gh',
        [
          'pr',
          'list',
          '--author',
          '@me',
          '--state',
          'open',
          '--json',
          'number,title,headRefName',
        ],
        { cwd: this.repoRoot },
      );

      return JSON.parse(stdout) as BotPR[];
    } catch (err) {
      this.logger.error(`Failed to list open PRs: ${(err as Error).message}`);
      return [];
    }
  }

  async getUnprocessedComments(prNumber: number): Promise<PRComment[]> {
    try {
      const { stdout } = await execFile(
        'gh',
        [
          'api',
          `repos/{owner}/{repo}/pulls/${prNumber}/comments`,
        ],
        { cwd: this.repoRoot },
      );

      const comments = JSON.parse(stdout) as PRComment[];
      return comments.filter(c => !this.processedCommentIds.has(c.id));
    } catch (err) {
      this.logger.error(
        `Failed to get comments for PR #${prNumber}: ${(err as Error).message}`,
      );
      return [];
    }
  }

  private async createReworkTask(pr: BotPR, comments: PRComment[]): Promise<void> {
    const commentSummary = comments
      .map(c => `- ${c.user.login}${c.path ? ` (${c.path})` : ''}: ${c.body}`)
      .join('\n');

    const description = `Address review feedback on PR #${pr.number} (${pr.title}):\n\n${commentSummary}`;

    await this.taskIntake.submitTask({
      title: `Rework: PR #${pr.number} feedback`,
      description,
      source: 'pr_feedback',
      sourceRef: `pr:${pr.number}`,
      branch: pr.headRefName,
    });

    this.logger.log(`Created rework task for PR #${pr.number}`);
  }
}
