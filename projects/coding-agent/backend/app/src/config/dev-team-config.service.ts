import { Injectable, Logger } from '@nestjs/common';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import { DevTeamConfig, ExecutionMode, ProviderConfig, TaskRole } from './dev-team-config.interface';

const DEFAULT_CONFIG: DevTeamConfig = {
  default: {
    engine: 'anthropic',
    model: 'claude-sonnet-4-6',
  },
  roles: {},
  maxConcurrent: 4,
  retryBudget: 3,
  keepEnvironmentForReview: false,
  executionMode: 'local',
};

@Injectable()
export class DevTeamConfigService {
  private readonly logger = new Logger(DevTeamConfigService.name);
  private config: DevTeamConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  /**
   * Walk up from cwd to find the repo root (has .git/ or .the-dev-team/).
   * Falls back to walking up from __dirname in case cwd is set to a subdirectory
   * (e.g., NestJS compiled dist/ directory).
   */
  private findRepoRoot(): string {
    for (const startDir of [process.cwd(), __dirname]) {
      let dir = startDir;
      while (dir !== path.dirname(dir)) {
        if (
          fs.existsSync(path.join(dir, '.the-dev-team')) ||
          fs.existsSync(path.join(dir, '.git'))
        ) {
          return dir;
        }
        dir = path.dirname(dir);
      }
    }
    return process.cwd();
  }

  private loadConfig(): DevTeamConfig {
    const repoRoot = this.findRepoRoot();
    const configPath = path.join(
      repoRoot,
      '.the-dev-team',
      'config',
      'the-dev-team.config.yml',
    );

    try {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const parsed = yaml.load(raw) as Partial<DevTeamConfig>;
      this.logger.log(`Loaded config from ${configPath}`);

      const config: DevTeamConfig = {
        default: parsed.default ?? DEFAULT_CONFIG.default,
        roles: parsed.roles ?? DEFAULT_CONFIG.roles,
        maxConcurrent: parsed.maxConcurrent ?? DEFAULT_CONFIG.maxConcurrent,
        retryBudget: parsed.retryBudget ?? DEFAULT_CONFIG.retryBudget,
        keepEnvironmentForReview:
          parsed.keepEnvironmentForReview ?? DEFAULT_CONFIG.keepEnvironmentForReview,
        executionMode: parsed.executionMode ?? DEFAULT_CONFIG.executionMode,
      };

      // Environment variable override for executionMode (used in K8s deployments)
      if (process.env.EXECUTION_MODE) {
        const envMode = process.env.EXECUTION_MODE as ExecutionMode;
        this.logger.log(`Overriding executionMode from env: ${envMode}`);
        config.executionMode = envMode;
      }

      return config;
    } catch (err) {
      this.logger.warn(
        `Could not load config from ${configPath}, using defaults: ${(err as Error).message}`,
      );
      const config = { ...DEFAULT_CONFIG };

      // Environment variable override for executionMode (used in K8s deployments)
      if (process.env.EXECUTION_MODE) {
        const envMode = process.env.EXECUTION_MODE as ExecutionMode;
        this.logger.log(`Overriding executionMode from env: ${envMode}`);
        config.executionMode = envMode;
      }

      return config;
    }
  }

  get maxConcurrentAgents(): number {
    return this.config.maxConcurrent;
  }

  get retryBudget(): number {
    return this.config.retryBudget;
  }

  get keepEnvironmentForReview(): boolean {
    return this.config.keepEnvironmentForReview;
  }

  get executionMode(): ExecutionMode {
    return this.config.executionMode;
  }

  getProviderConfig(role?: TaskRole): ProviderConfig {
    if (role && this.config.roles[role]) {
      return this.config.roles[role]!;
    }
    return this.config.default;
  }
}
