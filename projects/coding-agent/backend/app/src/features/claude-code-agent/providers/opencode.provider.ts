import { Injectable, Logger } from '@nestjs/common';
import { AgentProvider, AgentQueryOptions, AgentMessage } from './agent-provider.interface';

@Injectable()
export class OpenCodeProvider implements AgentProvider {
  private readonly logger = new Logger(OpenCodeProvider.name);
  readonly name = 'opencode';

  async *query(prompt: string, options: AgentQueryOptions): AsyncIterable<AgentMessage> {
    // TODO: Implement OpenCode SDK integration
    // OpenCode will default to Ollama and use a similar async generator pattern
    this.logger.warn('OpenCode provider is not yet implemented');
    throw new Error('OpenCode provider is not yet implemented. Please use claude-code.');
  }

  async isAvailable(): Promise<boolean> {
    // Will return true once OpenCode SDK is integrated
    return false;
  }
}
