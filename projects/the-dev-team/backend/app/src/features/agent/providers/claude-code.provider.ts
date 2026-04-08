import { Injectable, Logger } from '@nestjs/common';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { AgentProvider, AgentQueryOptions, AgentMessage } from './provider.interface';

@Injectable()
export class ClaudeCodeProvider implements AgentProvider {
  private readonly logger = new Logger(ClaudeCodeProvider.name);
  readonly name = 'claude-code';

  async *query(prompt: string, options: AgentQueryOptions): AsyncIterable<AgentMessage> {
    const queryOptions: Record<string, unknown> = {
      cwd: options.cwd,
      model: options.model,
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      abortController: options.abortController,
    };

    if (options.systemPrompt) {
      queryOptions.systemPrompt = options.systemPrompt;
    }

    if (options.resume) {
      queryOptions.resume = options.resume;
    }

    this.logger.debug('Executing Claude Code query');

    const result = query({
      prompt,
      options: queryOptions as Parameters<typeof query>[0]['options'],
    });

    for await (const message of result) {
      yield message as AgentMessage;
    }
  }

  async isAvailable(): Promise<boolean> {
    return !!process.env.CLAUDE_CODE_OAUTH_TOKEN;
  }
}
