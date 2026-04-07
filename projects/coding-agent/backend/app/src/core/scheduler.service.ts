import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { TaskIntakeService } from './task-intake.service';
import { EnvironmentManagerService } from './environment-manager.service';

const execFile = promisify(execFileCb);

/** Maximum age (in ms) before a sandbox is considered stale. Default: 24 hours. */
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly syncedTaskIds = new Set<string>();

  constructor(
    private readonly taskIntake: TaskIntakeService,
    private readonly environmentManager: EnvironmentManagerService,
  ) {}

  /**
   * Clean up stale environments every hour.
   *
   * Calls `task env:list` to discover active sandboxes, then destroys any
   * that are older than the configured threshold (default 24h).
   * Also destroys in-memory tracked environments that are unhealthy.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupStaleEnvironments(): Promise<void> {
    this.logger.debug('Running stale environment cleanup');

    // Strategy 1: Use task env:list to find sandboxes via Taskfile
    await this.cleanupViaCli();

    // Strategy 2: Check in-memory tracked environments for unhealthy ones
    const environments = this.environmentManager.getTrackedEnvironments();
    for (const env of environments) {
      try {
        const health = await this.environmentManager.checkHealth(env.taskId);
        if (!health.healthy) {
          this.logger.warn(
            `Environment for task ${env.taskId} is unhealthy — destroying`,
          );
          try {
            await this.environmentManager.destroyEnvironment(env.taskId);
            this.logger.log(`Destroyed unhealthy environment for task ${env.taskId}`);
          } catch (destroyErr) {
            this.logger.error(
              `Failed to destroy environment for ${env.taskId}: ${(destroyErr as Error).message}`,
            );
          }
        }
      } catch (err) {
        this.logger.error(
          `Health check failed for ${env.taskId}: ${(err as Error).message}`,
        );
      }
    }
  }

  /**
   * Discover and clean up stale sandboxes via `task env:list`.
   */
  private async cleanupViaCli(): Promise<void> {
    let listOutput: string;
    try {
      const { stdout } = await execFile('task', ['env:list'], {
        timeout: 30_000,
        maxBuffer: 1024 * 1024,
      });
      listOutput = stdout;
    } catch (err) {
      const error = err as Error & { stderr?: string };
      const msg = error.stderr || error.message;

      // No K8s cluster or no task command — that's OK
      if (
        msg.includes('not found') ||
        msg.includes('command not found') ||
        msg.includes('no resources found') ||
        msg.includes('connection refused')
      ) {
        this.logger.debug('No sandbox infrastructure available — skipping CLI cleanup');
        return;
      }

      this.logger.warn(`env:list failed: ${msg}`);
      return;
    }

    // Parse output: each line typically has namespace/name, task-id, creation timestamp
    // Expected format varies, but we look for lines with timestamps
    const lines = listOutput.trim().split('\n').filter((l) => l.trim().length > 0);
    const now = Date.now();

    for (const line of lines) {
      // Try to extract a task-id and timestamp from the line
      // Common format: "namespace  task-id  2025-01-15T10:30:00Z  status"
      const parts = line.trim().split(/\s+/);
      if (parts.length < 2) continue;

      // Find a part that looks like a timestamp (ISO 8601)
      let createdAt: Date | null = null;
      let taskId: string | null = null;

      for (const part of parts) {
        // ISO 8601 timestamp
        if (/^\d{4}-\d{2}-\d{2}T/.test(part)) {
          const parsed = new Date(part);
          if (!isNaN(parsed.getTime())) {
            createdAt = parsed;
          }
        }
        // Task ID pattern (UUID-like or task/ prefix)
        if (/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(part) || part.startsWith('task-')) {
          taskId = part;
        }
      }

      // If we couldn't find a task-id, use the second column as a heuristic
      if (!taskId && parts.length >= 2) {
        taskId = parts[1];
      }

      if (!taskId) continue;

      // If we have a timestamp, check age
      if (createdAt) {
        const ageMs = now - createdAt.getTime();
        if (ageMs > STALE_THRESHOLD_MS) {
          this.logger.log(
            `Sandbox "${taskId}" is ${Math.round(ageMs / 3600000)}h old — destroying`,
          );
          try {
            await execFile('task', ['env:destroy', '--', taskId], {
              timeout: 60_000,
            });
            this.logger.log(`Destroyed stale sandbox: ${taskId}`);
          } catch (destroyErr) {
            this.logger.error(
              `Failed to destroy sandbox ${taskId}: ${(destroyErr as Error).message}`,
            );
          }
        }
      }
    }
  }

  /**
   * Poll GitHub issues every 5 minutes for new work.
   */
  @Cron('0 */5 * * * *')
  async pollGitHubIssues(): Promise<void> {
    this.logger.debug('Polling GitHub issues for new tasks');

    try {
      await this.taskIntake.pollGitHubIssues();
    } catch (err) {
      this.logger.error(
        `GitHub polling failed: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Sync completed/failed task history to disk every 15 minutes.
   *
   * Copies task state from `.worktrees/{task-id}/.the-dev-team/state/{task-id}/`
   * to `.the-dev-team/history/`, and appends summaries to `index.jsonl`.
   */
  @Cron('0 */15 * * * *')
  async syncHistory(): Promise<void> {
    this.logger.debug('Syncing task history to disk');

    const tasks = this.taskIntake.getAllTasks();
    const completedTasks = tasks.filter(
      (t) =>
        (t.status === 'completed' || t.status === 'failed') &&
        !this.syncedTaskIds.has(t.id),
    );

    if (completedTasks.length === 0) {
      this.logger.debug('No new completed/failed tasks to sync');
      return;
    }

    // Find repo root by walking up from cwd
    const repoRoot = this.findRepoRoot();
    const historyDir = path.join(repoRoot, '.the-dev-team', 'history');
    const indexPath = path.join(historyDir, 'index.jsonl');

    try {
      await fs.mkdir(historyDir, { recursive: true });
    } catch {
      // Directory may already exist
    }

    for (const task of completedTasks) {
      try {
        // Copy state files from worktree if they exist
        if (task.worktreePath) {
          const stateDir = path.join(
            task.worktreePath,
            '.the-dev-team',
            'state',
            task.id,
          );
          const taskHistoryDir = path.join(historyDir, task.id);

          try {
            await fs.access(stateDir);
            await this.copyDirectory(stateDir, taskHistoryDir);
            this.logger.debug(`Copied state for task ${task.id} to history`);
          } catch {
            // State directory may not exist — that's fine
            this.logger.debug(
              `No state directory found for task ${task.id} at ${stateDir}`,
            );
          }

          // Copy transcript files if they exist
          const transcriptDir = path.join(
            task.worktreePath,
            '.the-dev-team',
            'transcripts',
            task.id,
          );
          const transcriptHistoryDir = path.join(
            historyDir,
            task.id,
            'transcripts',
          );

          try {
            await fs.access(transcriptDir);
            await this.copyDirectory(transcriptDir, transcriptHistoryDir);
            this.logger.debug(
              `Copied transcripts for task ${task.id} to history`,
            );
          } catch {
            // Transcript directory may not exist
          }
        }

        // Append summary to index.jsonl
        const summary = {
          id: task.id,
          title: task.title,
          source: task.source,
          sourceRef: task.sourceRef,
          status: task.status,
          branch: task.branch,
          touchesFrontend: task.touchesFrontend,
          cost: task.cost,
          createdAt: task.createdAt.toISOString(),
          startedAt: task.startedAt?.toISOString() ?? null,
          completedAt: task.completedAt?.toISOString() ?? null,
          changedFiles: task.changedFiles ?? [],
          gateResults: task.gateResults ?? [],
          syncedAt: new Date().toISOString(),
        };

        await fs.appendFile(indexPath, JSON.stringify(summary) + '\n', 'utf-8');
        this.syncedTaskIds.add(task.id);

        this.logger.log(
          `Synced history for task ${task.id} (${task.status})`,
        );
      } catch (err) {
        this.logger.error(
          `Failed to sync history for task ${task.id}: ${(err as Error).message}`,
        );
      }
    }

    // Optionally trigger a repository dispatch for git branch sync
    this.triggerHistoryDispatch().catch((err) => {
      this.logger.debug(
        `History dispatch skipped: ${(err as Error).message}`,
      );
    });
  }

  /**
   * Fire a GitHub repository dispatch event so an external workflow
   * can commit history changes to a branch.
   */
  private async triggerHistoryDispatch(): Promise<void> {
    try {
      // Get the current repo from gh
      const { stdout: repoSlug } = await execFile(
        'gh',
        ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'],
        { timeout: 10_000 },
      );

      const repo = repoSlug.trim();
      if (!repo) return;

      await execFile(
        'gh',
        [
          'api',
          `repos/${repo}/dispatches`,
          '-f',
          'event_type=history-sync',
        ],
        { timeout: 10_000 },
      );

      this.logger.debug(`Triggered history-sync dispatch for ${repo}`);
    } catch {
      // Dispatch is best-effort — ignore failures silently
    }
  }

  /**
   * Recursively copy a directory.
   */
  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  /**
   * Walk up from cwd to find the repo root.
   */
  private findRepoRoot(): string {
    const { existsSync } = require('fs');
    let dir = process.cwd();
    while (dir !== path.dirname(dir)) {
      if (
        existsSync(path.join(dir, '.the-dev-team')) ||
        existsSync(path.join(dir, '.git'))
      ) {
        return dir;
      }
      dir = path.dirname(dir);
    }
    return process.cwd();
  }
}
