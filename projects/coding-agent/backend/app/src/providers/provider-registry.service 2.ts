import { Injectable, Logger } from '@nestjs/common';
import { DevTeamConfigService } from '../config/dev-team-config.service';
import { ProviderConfig, TaskRole } from '../config/dev-team-config.interface';
import {
  CodingAgentProvider,
  ProviderHealthStatus,
} from './coding-agent-provider.interface';
import { ClaudeCodeProvider } from './claude-code.provider';
import { OpenCodeProvider } from './opencode.provider';

@Injectable()
export class ProviderRegistryService {
  private readonly logger = new Logger(ProviderRegistryService.name);
  private readonly cache = new Map<string, CodingAgentProvider>();

  constructor(private readonly configService: DevTeamConfigService) {}

  getForRole(role: TaskRole): CodingAgentProvider {
    const config = this.configService.getProviderConfig(role);
    return this.resolve(config);
  }

  resolve(config: ProviderConfig): CodingAgentProvider {
    const cacheKey = `${config.engine}:${config.provider ?? 'default'}:${config.model}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    let provider: CodingAgentProvider;

    switch (config.engine) {
      case 'anthropic':
        provider = new ClaudeCodeProvider(config.model);
        break;
      case 'opencode':
        provider = new OpenCodeProvider(config.provider, config.model);
        break;
      default:
        throw new Error(`Unknown engine: ${config.engine}`);
    }

    this.cache.set(cacheKey, provider);
    this.logger.log(`Resolved provider: ${cacheKey}`);
    return provider;
  }

  async healthCheckAll(): Promise<Record<string, ProviderHealthStatus>> {
    const results: Record<string, ProviderHealthStatus> = {};

    for (const [key, provider] of this.cache.entries()) {
      try {
        results[key] = await provider.healthCheck();
      } catch (err) {
        results[key] = {
          healthy: false,
          message: `Health check failed: ${(err as Error).message}`,
        };
      }
    }

    // Also check default provider if not in cache
    const defaultConfig = this.configService.getProviderConfig();
    const defaultKey = `${defaultConfig.engine}:${defaultConfig.provider ?? 'default'}:${defaultConfig.model}`;
    if (!results[defaultKey]) {
      const defaultProvider = this.resolve(defaultConfig);
      try {
        results[defaultKey] = await defaultProvider.healthCheck();
      } catch (err) {
        results[defaultKey] = {
          healthy: false,
          message: `Health check failed: ${(err as Error).message}`,
        };
      }
    }

    return results;
  }
}
