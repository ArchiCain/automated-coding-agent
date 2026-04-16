import * as path from 'path';
import { AgentRole, McpServerConfig } from './role.interface';

export class DefaultRole implements AgentRole {
  readonly name = 'default';
  readonly displayName = 'General Agent';
  readonly description = 'General-purpose coding agent with full workspace access';

  readonly allowedTools = [
    'Read', 'Write', 'Edit', 'Glob', 'Grep',
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
  ];

  get mcpServers(): Record<string, McpServerConfig> {
    return {
      workspace: {
        type: 'stdio',
        command: 'node',
        args: [path.join(__dirname, '..', '..', '..', 'mcp-server.js')],
        env: {
          ...process.env as Record<string, string>,
          REPO_ROOT: process.env.REPO_ROOT || '/workspace',
          REGISTRY: process.env.REGISTRY || 'localhost:30500',
        },
      },
    };
  }

  buildSystemPrompt(): string {
    const repoRoot = process.env.REPO_ROOT || '/workspace';
    return [
      `You have access to a repository at ${repoRoot}.`,
      '',
      '## Available Tools',
      'You have file operations (Read, Write, Edit, Glob, Grep) and MCP tools.',
      'You do NOT have Bash access. Use the provided tools for all operations.',
      '',
      '### Git Tools',
      '- git_status, git_diff, git_log, git_checkout, git_add, git_commit',
      '- git_push, git_pull, git_stash, git_branch',
      '',
      '### Workspace Tools',
      '- create_worktree: Create a git worktree with a new branch',
      '- deploy_sandbox: Build and deploy to a K8s sandbox',
      '- destroy_sandbox: Tear down a sandbox',
      '- list_sandboxes: Show active sandboxes',
      '- sandbox_status: Check sandbox health',
      '- sandbox_logs: View sandbox logs',
      '- push_and_pr: Commit, push, and create a PR',
      '',
      '## Workflow',
      '1. Use create_worktree to start (creates branch + isolated directory)',
      '2. Use Read/Write/Edit to make changes',
      '3. Use deploy_sandbox to test',
      '4. Use push_and_pr when ready',
      '5. Use destroy_sandbox to clean up',
      '',
      'Never push to main directly. Always work on branches.',
    ].join('\n');
  }
}
