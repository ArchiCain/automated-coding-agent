import { Injectable, Logger } from '@nestjs/common';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execFile = promisify(execFileCb);

@Injectable()
export class GitService {
  private readonly logger = new Logger(GitService.name);
  private readonly repoRoot: string;

  constructor() {
    this.repoRoot = process.env.REPO_ROOT || process.cwd();
  }

  async fetch(): Promise<string> {
    this.logger.debug('Fetching from remote');
    const { stdout } = await execFile('git', ['fetch', '--all', '--prune'], {
      cwd: this.repoRoot,
    });
    return stdout;
  }

  async createWorktree(taskId: string, branch: string): Promise<string> {
    const worktreePath = path.join(this.repoRoot, '.worktrees', taskId);
    this.logger.log(`Creating worktree at ${worktreePath} on branch ${branch}`);

    try {
      // Check if branch exists
      await execFile('git', ['rev-parse', '--verify', branch], {
        cwd: this.repoRoot,
      });
      // Branch exists, use it
      await execFile('git', ['worktree', 'add', worktreePath, branch], {
        cwd: this.repoRoot,
      });
    } catch {
      // Branch does not exist, create it
      await execFile('git', ['worktree', 'add', '-b', branch, worktreePath], {
        cwd: this.repoRoot,
      });
    }

    return worktreePath;
  }

  async removeWorktree(taskId: string): Promise<void> {
    const worktreePath = path.join(this.repoRoot, '.worktrees', taskId);
    this.logger.log(`Removing worktree at ${worktreePath}`);

    try {
      await execFile('git', ['worktree', 'remove', worktreePath, '--force'], {
        cwd: this.repoRoot,
      });
    } catch (err) {
      this.logger.warn(`Worktree removal failed: ${(err as Error).message}`);
    }

    await execFile('git', ['worktree', 'prune'], { cwd: this.repoRoot });
  }

  async addAll(cwd: string): Promise<void> {
    await execFile('git', ['add', '-A'], { cwd });
  }

  async commit(cwd: string, message: string): Promise<string> {
    const { stdout } = await execFile('git', ['commit', '-m', message], { cwd });
    return stdout;
  }

  async push(
    branch: string,
    options?: { force?: boolean; setUpstream?: boolean },
  ): Promise<string> {
    const args = ['push'];
    if (options?.setUpstream) {
      args.push('-u', 'origin', branch);
    } else {
      args.push('origin', branch);
    }
    if (options?.force) {
      args.push('--force-with-lease');
    }
    const { stdout } = await execFile('git', args, { cwd: this.repoRoot });
    return stdout;
  }

  async rebase(cwd: string, onto: string): Promise<string> {
    const { stdout } = await execFile('git', ['rebase', onto], { cwd });
    return stdout;
  }

  async getDiff(cwd: string): Promise<string> {
    const { stdout } = await execFile('git', ['diff', 'HEAD'], { cwd });
    return stdout;
  }
}
