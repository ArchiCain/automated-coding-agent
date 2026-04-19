import { Controller, Post, Body, Logger } from '@nestjs/common';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execFile = promisify(execFileCb);

const REPO_ROOT = process.env.REPO_ROOT || '/workspace';
const DEPLOY_BRANCH = process.env.DEPLOY_BRANCH || 'local-scain';
const REGISTRY = process.env.REGISTRY || 'localhost:30500';

interface SyncSetupResult {
  worktreePath: string;
  branch: string;
  featureName: string;
  sandboxName: string;
}

@Controller('api/mastra/sync')
export class SyncSetupController {
  private readonly logger = new Logger(SyncSetupController.name);

  @Post('setup')
  async setup(@Body() body: { featurePath: string }): Promise<SyncSetupResult> {
    const { featurePath } = body;

    // Derive feature name from path
    // e.g. "projects/application/frontend/app/src/features/auth/" → "auth"
    // e.g. "frontend/app/src/features/dark-mode" → "dark-mode"
    const featureName = this.deriveFeatureName(featurePath);
    const branch = `feature/${featureName}`;
    const worktreePath = path.resolve(REPO_ROOT, `.worktrees/${featureName}`);
    const sandboxName = featureName;

    this.logger.log(`Sync setup: feature=${featureName}, branch=${branch}`);

    // Check if worktree already exists (idempotent)
    if (fs.existsSync(worktreePath)) {
      this.logger.log(`Worktree already exists at ${worktreePath}`);
      return { worktreePath, branch, featureName, sandboxName };
    }

    // Fetch latest from remote
    await this.runGit(['fetch', 'origin', DEPLOY_BRANCH]);

    // Create worktree with new branch from deploy branch
    try {
      await this.runGit([
        'worktree', 'add', '-b', branch,
        worktreePath, `origin/${DEPLOY_BRANCH}`,
      ]);
    } catch {
      // Branch may already exist — try checking it out
      try {
        await this.runGit(['worktree', 'add', worktreePath, branch]);
      } catch (err) {
        this.logger.error(`Failed to create worktree: ${err}`);
        throw err;
      }
    }

    this.logger.log(`Worktree created at ${worktreePath} on branch ${branch}`);

    // Deploy sandbox from worktree
    try {
      this.logger.log(`Deploying sandbox: ${sandboxName}`);
      await this.runTask('env:deploy', {
        NAME: sandboxName,
        WORKTREE: worktreePath,
        REGISTRY,
      });
      this.logger.log(`Sandbox deployed: ${sandboxName}`);
    } catch (err) {
      this.logger.warn(`Sandbox deployment failed (continuing anyway): ${err}`);
      // Don't throw — the worktree is still valid even if sandbox fails
    }

    return { worktreePath, branch, featureName, sandboxName };
  }

  private deriveFeatureName(featurePath: string): string {
    // Strip trailing slash
    const cleaned = featurePath.replace(/\/+$/, '');

    // Try to extract the feature name from a "features/{name}" pattern
    const match = cleaned.match(/features\/([^/]+)$/);
    if (match) return match[1];

    // Fall back to last path segment
    return path.basename(cleaned);
  }

  private async runGit(args: string[]): Promise<string> {
    const { stdout } = await execFile('git', args, {
      cwd: REPO_ROOT,
      timeout: 60_000,
    });
    return stdout;
  }

  private async runTask(
    taskName: string,
    vars: Record<string, string>,
  ): Promise<string> {
    const args = [taskName];
    for (const [key, value] of Object.entries(vars)) {
      args.push(`${key}=${value}`);
    }
    const { stdout } = await execFile('task', args, {
      cwd: REPO_ROOT,
      timeout: 600_000, // 10 minutes for deploy
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout;
  }
}
