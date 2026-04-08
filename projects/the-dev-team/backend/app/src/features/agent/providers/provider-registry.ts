import { Injectable, Logger } from '@nestjs/common';
import { AgentProvider } from './provider.interface';
import { ClaudeCodeProvider } from './claude-code.provider';
import { OpenCodeProvider } from './opencode.provider';

@Injectable()
export class ProviderRegistry {
  private readonly logger = new Logger(ProviderRegistry.name);
  private readonly providers: Map<string, AgentProvider> = new Map();

  constructor(
    private readonly claudeCode: ClaudeCodeProvider,
    private readonly openCode: OpenCodeProvider,
  ) {
    this.providers.set(claudeCode.name, claudeCode);
    this.providers.set(openCode.name, openCode);
  }

  getProvider(name?: string): AgentProvider {
    if (name) {
      const provider = this.providers.get(name);
      if (!provider) {
        throw new Error(`Provider "${name}" not found. Available: ${[...this.providers.keys()].join(', ')}`);
      }
      return provider;
    }
    // Default to claude-code
    return this.claudeCode;
  }

  getAvailableProviders(): string[] {
    return [...this.providers.keys()];
  }
}
