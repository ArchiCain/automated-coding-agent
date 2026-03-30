import { Injectable, Logger } from '@nestjs/common';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { AgentProvider, AgentQueryOptions, AgentMessage } from './agent-provider.interface';

@Injectable()
export class ClaudeCodeProvider implements AgentProvider {
  private readonly logger = new Logger(ClaudeCodeProvider.name);
  readonly name = 'claude-code';

  async *query(prompt: string, options: AgentQueryOptions): AsyncIterable<AgentMessage> {
    const queryOptions: Record<string, unknown> = {
      cwd: options.cwd,
      model: options.model,
      permissionMode: options.readOnly ? 'plan' : 'bypassPermissions',
      allowDangerouslySkipPermissions: !options.readOnly,
      abortController: options.abortController,
    };

    if (options.additionalDirectories?.length) {
      queryOptions.additionalDirectories = options.additionalDirectories;
    }

    if (options.systemPrompt) {
      queryOptions.systemPrompt = options.systemPrompt;
    }

    if (options.resume) {
      queryOptions.resume = options.resume;
    }

    if (options.env) {
      queryOptions.env = options.env;
    }

    this.logger.debug(`Executing Claude Code query (readOnly=${options.readOnly ?? false})`);

    const result = query({
      prompt,
      options: queryOptions as Parameters<typeof query>[0]['options'],
    });

    for await (const message of result) {
      yield message as AgentMessage;
    }
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
