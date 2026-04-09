import { Injectable, Logger } from '@nestjs/common';
import { query } from '@anthropic-ai/claude-agent-sdk';
import {
  CodingAgentProvider,
  AgentExecutionRequest,
  AgentMessage,
  ProviderHealthStatus,
  ProviderCapabilities,
} from './coding-agent-provider.interface';

@Injectable()
export class ClaudeCodeProvider implements CodingAgentProvider {
  private readonly logger = new Logger(ClaudeCodeProvider.name);
  readonly id = 'claude-code';
  readonly name = 'Claude Code (Anthropic)';
  private readonly model: string;

  constructor(model?: string) {
    this.model = model ?? 'claude-sonnet-4-6';
  }

  async *execute(request: AgentExecutionRequest): AsyncIterable<AgentMessage> {
    this.logger.debug(`Executing Claude Code query in ${request.cwd}`);

    const abortController = new AbortController();
    if (request.signal) {
      request.signal.addEventListener('abort', () => abortController.abort());
    }

    const queryOptions: Record<string, unknown> = {
      cwd: request.cwd,
      model: this.model,
      systemPrompt: request.systemPrompt,
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      abortController,
      // Use the system-installed Claude CLI (supports OAuth tokens)
      // The SDK's bundled CLI doesn't support CLAUDE_CODE_OAUTH_TOKEN
      pathToClaudeCodeExecutable: process.env.CLAUDE_CODE_PATH || '/opt/homebrew/bin/claude',
    };

    // Only resume if explicitly flagged (sessionId alone is not enough —
    // it's also used for tracking new sessions)
    if (request.sessionId && request.resume) {
      queryOptions.resume = request.sessionId;
    }

    const result = query({
      prompt: request.prompt,
      options: queryOptions as Parameters<typeof query>[0]['options'],
    });

    for await (const message of result) {
      const msg = message as Record<string, unknown>;

      // Log errors in full for debugging
      if (msg.is_error || msg.subtype === 'error_during_execution') {
        this.logger.error(`Claude Code error: ${JSON.stringify(msg)}`);
      }

      const type = this.mapMessageType(msg.type as string);
      yield {
        type,
        content: this.extractContent(msg),
        raw: msg,
      };
    }
  }

  async healthCheck(): Promise<ProviderHealthStatus> {
    const start = Date.now();
    try {
      // Simple check: verify the SDK is importable and functional
      return {
        healthy: true,
        message: 'Claude Code SDK available',
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return {
        healthy: false,
        message: `Claude Code SDK error: ${(err as Error).message}`,
        latencyMs: Date.now() - start,
      };
    }
  }

  capabilities(): ProviderCapabilities {
    return {
      shellExecution: true,
      fileOperations: true,
      agenticLoop: true,
      sessionResume: true,
      contextWindow: 200_000,
    };
  }

  private mapMessageType(
    sdkType: string,
  ): AgentMessage['type'] {
    switch (sdkType) {
      case 'assistant':
        return 'text';
      case 'tool_use':
        return 'tool_use';
      case 'tool_result':
        return 'tool_result';
      case 'error':
        return 'error';
      case 'result':
        return 'complete';
      default:
        return 'status';
    }
  }

  private extractContent(msg: Record<string, unknown>): string {
    if (typeof msg.content === 'string') {
      return msg.content;
    }
    if (Array.isArray(msg.content)) {
      return msg.content
        .map((block: Record<string, unknown>) => block.text ?? '')
        .join('');
    }
    return JSON.stringify(msg);
  }
}
