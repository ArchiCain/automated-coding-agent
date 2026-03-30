import { Injectable, Logger } from '@nestjs/common';
import { AgentProvider } from './agent-provider.interface';
import { ClaudeCodeProvider } from './claude-code.provider';
import { OpenCodeProvider } from './opencode.provider';

@Injectable()
export class AgentProviderRegistry {
  private readonly logger = new Logger(AgentProviderRegistry.name);
  private readonly providers = new Map<string, AgentProvider>();

  constructor(
    private readonly claudeCode: ClaudeCodeProvider,
    private readonly openCode: OpenCodeProvider,
  ) {
    this.providers.set(claudeCode.name, claudeCode);
    this.providers.set(openCode.name, openCode);
    this.logger.log(`Registered providers: ${Array.from(this.providers.keys()).join(', ')}`);
  }

  get(name: string): AgentProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Unknown agent provider: ${name}. Available: ${Array.from(this.providers.keys()).join(', ')}`);
    }
    return provider;
  }

  async listAvailable(): Promise<{ name: string; available: boolean }[]> {
    const results: { name: string; available: boolean }[] = [];
    for (const [name, provider] of this.providers) {
      results.push({ name, available: await provider.isAvailable() });
    }
    return results;
  }
}
