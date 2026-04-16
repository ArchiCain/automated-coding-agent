import { Injectable, Logger } from '@nestjs/common';
import { query } from '@anthropic-ai/claude-agent-sdk';
import * as path from 'path';
import { AgentProvider, AgentQueryOptions, AgentMessage } from './provider.interface';

@Injectable()
export class ClaudeCodeProvider implements AgentProvider {
  private readonly logger = new Logger(ClaudeCodeProvider.name);
  readonly name = 'claude-code';

  /**
   * Path to the compiled MCP server that provides workspace tools
   * (deploy_sandbox, create_worktree, push_and_pr, etc.)
   */
  private get mcpServerPath(): string {
    return path.join(__dirname, '..', '..', '..', 'mcp-server.js');
  }

  async *query(prompt: string, options: AgentQueryOptions): AsyncIterable<AgentMessage> {
    const defaultAllowedTools = [
      'Read', 'Write', 'Edit', 'Glob', 'Grep',
      'mcp__workspace__create_worktree',
      'mcp__workspace__deploy_sandbox',
      'mcp__workspace__destroy_sandbox',
      'mcp__workspace__list_sandboxes',
      'mcp__workspace__sandbox_status',
      'mcp__workspace__sandbox_logs',
      'mcp__workspace__push_and_pr',
      'mcp__workspace__create_github_issue',
      'mcp__workspace__git_status',
      'mcp__workspace__git_diff',
      'mcp__workspace__git_log',
      'mcp__workspace__git_checkout',
      'mcp__workspace__git_add',
      'mcp__workspace__git_commit',
      'mcp__workspace__git_push',
      'mcp__workspace__git_pull',
      'mcp__workspace__git_stash',
      'mcp__workspace__git_branch',
    ];

    const queryOptions: Record<string, unknown> = {
      cwd: options.cwd,
      model: options.model,
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      abortController: options.abortController,

      // allowedTools auto-approves without permission prompts
      allowedTools: options.allowedTools || defaultAllowedTools,

      // disallowedTools removes tools from the model's context entirely
      ...(options.disallowedTools?.length ? { disallowedTools: options.disallowedTools } : {}),

      // MCP servers — role-provided or defaults
      mcpServers: options.mcpServers || {
        workspace: {
          type: 'stdio',
          command: 'node',
          args: [this.mcpServerPath],
          env: {
            ...process.env as Record<string, string>,
            REPO_ROOT: process.env.REPO_ROOT || '/workspace',
            REGISTRY: process.env.REGISTRY || 'localhost:30500',
          },
        },
      },
    };

    if (options.systemPrompt) {
      queryOptions.systemPrompt = options.systemPrompt;
    }

    if (options.resume) {
      queryOptions.resume = options.resume;
    }

    this.logger.log(`Tools config — allowedTools: ${JSON.stringify(queryOptions.allowedTools)}`);
    this.logger.log(`Tools config — disallowedTools: ${JSON.stringify(queryOptions.disallowedTools)}`);
    this.logger.log(`MCP servers: ${JSON.stringify(Object.keys(queryOptions.mcpServers as Record<string, unknown>))}`);

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
