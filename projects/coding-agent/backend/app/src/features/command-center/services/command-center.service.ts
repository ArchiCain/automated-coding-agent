import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

export interface CommandCenterConfig {
  baseBranch: string;
  lastUpdated: string;
}

export interface DockerServiceStatus {
  Name: string;
  State: string;
  Health: string;
  Service: string;
}

@Injectable()
export class CommandCenterService implements OnModuleInit {
  private readonly logger = new Logger(CommandCenterService.name);
  private repoRoot: string;
  private configDir: string;
  private configFile: string;

  constructor() {
    // Navigate from dist/features/command-center/services to repo root
    this.repoRoot = process.env.REPO_ROOT || path.resolve(__dirname, '../../../../../../../');
    this.configDir = path.join(this.repoRoot, '.prod');
    this.configFile = path.join(this.configDir, 'config.json');
  }

  async onModuleInit(): Promise<void> {
    await this.ensureConfigDir();
  }

  private async ensureConfigDir(): Promise<void> {
    try {
      await fs.mkdir(this.configDir, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create config directory', error);
    }
  }

  /**
   * Get the current configuration
   */
  async getConfig(): Promise<CommandCenterConfig> {
    try {
      const content = await fs.readFile(this.configFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      // Return default config if file doesn't exist
      return {
        baseBranch: 'main',
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  /**
   * Set the base branch
   */
  async setBaseBranch(branch: string): Promise<CommandCenterConfig> {
    const config = await this.getConfig();
    config.baseBranch = branch;
    config.lastUpdated = new Date().toISOString();

    await fs.writeFile(this.configFile, JSON.stringify(config, null, 2));
    this.logger.log(`Set base branch to: ${branch}`);

    return config;
  }

  /**
   * Get the current git branch
   */
  async getCurrentBranch(): Promise<string> {
    try {
      const { stdout } = await execAsync('git branch --show-current', {
        cwd: this.repoRoot,
      });
      return stdout.trim();
    } catch (error) {
      this.logger.error('Failed to get current branch', error);
      throw error;
    }
  }

  /**
   * List all branches (local and remote)
   */
  async listBranches(query?: string): Promise<string[]> {
    try {
      // Fetch latest from remote first
      await execAsync('git fetch --prune', { cwd: this.repoRoot }).catch(() => {
        // Ignore fetch errors (might be offline)
      });

      const { stdout } = await execAsync('git branch -a --format="%(refname:short)"', {
        cwd: this.repoRoot,
      });

      let branches = stdout
        .split('\n')
        .map((b) => b.trim())
        .filter((b) => b.length > 0)
        // Remove origin/ prefix for remote branches
        .map((b) => b.replace(/^origin\//, ''))
        // Remove duplicates
        .filter((b, i, arr) => arr.indexOf(b) === i)
        // Remove HEAD
        .filter((b) => b !== 'HEAD')
        .sort();

      if (query) {
        const lowerQuery = query.toLowerCase();
        branches = branches.filter((b) => b.toLowerCase().includes(lowerQuery));
      }

      return branches;
    } catch (error) {
      this.logger.error('Failed to list branches', error);
      throw error;
    }
  }

  /**
   * Switch to a different branch
   */
  async switchBranch(branch: string): Promise<{ success: boolean; message: string }> {
    try {
      // First, check if there are uncommitted changes
      const { stdout: statusOutput } = await execAsync('git status --porcelain', {
        cwd: this.repoRoot,
      });

      if (statusOutput.trim()) {
        return {
          success: false,
          message: 'Cannot switch branches: you have uncommitted changes',
        };
      }

      // Switch to the branch
      await execAsync(`git checkout ${branch}`, {
        cwd: this.repoRoot,
      });

      // Pull latest
      await execAsync('git pull', { cwd: this.repoRoot }).catch(() => {
        // Ignore pull errors (might be offline or no upstream)
      });

      this.logger.log(`Switched to branch: ${branch}`);
      return { success: true, message: `Switched to branch: ${branch}` };
    } catch (error) {
      this.logger.error(`Failed to switch to branch ${branch}`, error);
      return {
        success: false,
        message: `Failed to switch branch: ${error.message}`,
      };
    }
  }

  /**
   * Get git status
   */
  async getGitStatus(): Promise<{
    branch: string;
    clean: boolean;
    ahead: number;
    behind: number;
  }> {
    try {
      const branch = await this.getCurrentBranch();

      const { stdout: statusOutput } = await execAsync('git status --porcelain', {
        cwd: this.repoRoot,
      });
      const clean = statusOutput.trim().length === 0;

      // Get ahead/behind counts
      let ahead = 0;
      let behind = 0;
      try {
        const { stdout: aheadBehind } = await execAsync(
          'git rev-list --left-right --count HEAD...@{upstream}',
          { cwd: this.repoRoot }
        );
        const [aheadStr, behindStr] = aheadBehind.trim().split('\t');
        ahead = parseInt(aheadStr, 10) || 0;
        behind = parseInt(behindStr, 10) || 0;
      } catch {
        // Ignore if no upstream
      }

      return { branch, clean, ahead, behind };
    } catch (error) {
      this.logger.error('Failed to get git status', error);
      throw error;
    }
  }

  /**
   * Get Docker container status
   */
  async getDockerStatus(): Promise<DockerServiceStatus[]> {
    try {
      const { stdout } = await execAsync(
        'docker compose ps -a --format json',
        {
          cwd: path.join(this.repoRoot, 'projects'),
        }
      );

      // Docker outputs one JSON object per line
      const containers: DockerServiceStatus[] = stdout
        .trim()
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter((c) => c !== null);

      return containers;
    } catch (error) {
      this.logger.error('Failed to get docker status', error);
      return [];
    }
  }
}
