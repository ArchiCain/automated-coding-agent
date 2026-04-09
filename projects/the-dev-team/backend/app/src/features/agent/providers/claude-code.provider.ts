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
    // In production (K8s): compiled to dist/mcp-server.js
    // In dev: may be in src — but we always reference the dist version
    return path.join(__dirname, '..', '..', '..', 'mcp-server.js');
  }

  async *query(prompt: string, options: AgentQueryOptions): AsyncIterable<AgentMessage> {
    const queryOptions: Record<string, unknown> = {
      cwd: options.cwd,
      model: options.model,
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      abortController: options.abortController,

      // Restrict tools — no Bash, no arbitrary command execution.
      // The agent can only use file operations + MCP tools we define.
      allowedTools: [
        // Built-in file operations
        'Read', 'Write', 'Edit', 'Glob', 'Grep',
        // All MCP tools from the workspace server
        'mcp__workspace__create_worktree',
        'mcp__workspace__deploy_sandbox',
        'mcp__workspace__destroy_sandbox',
        'mcp__workspace__list_sandboxes',
        'mcp__workspace__sandbox_status',
        'mcp__workspace__sandbox_logs',
        'mcp__workspace__push_and_pr',
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
      ],

      // Register the workspace MCP server — provides structured tools
      // for git, sandbox deployment, worktree management, PR creation.
      mcpServers: {
        workspace: {
          type: 'stdio',
          command: 'node',
          args: [this.mcpServerPath],
          env: {
            REPO_ROOT: process.env.REPO_ROOT || '/workspace',
            REGISTRY: process.env.REGISTRY || 'localhost:30500',
            GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
            GH_TOKEN: process.env.GH_TOKEN || '',
            PATH: process.env.PATH || '',
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

    this.logger.debug('Executing Claude Code query with workspace MCP tools');

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
