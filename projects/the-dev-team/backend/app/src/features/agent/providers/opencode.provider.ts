import { Injectable, Logger } from '@nestjs/common';
import { AgentProvider, AgentQueryOptions, AgentMessage } from './provider.interface';
import { execSync } from 'child_process';

@Injectable()
export class OpenCodeProvider implements AgentProvider {
  private readonly logger = new Logger(OpenCodeProvider.name);
  readonly name = 'opencode';

  async *query(_prompt: string, _options: AgentQueryOptions): AsyncIterable<AgentMessage> {
    throw new Error('OpenCode provider is not yet implemented');
  }

  async isAvailable(): Promise<boolean> {
    try {
      execSync('which opencode', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }
}
