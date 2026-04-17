import * as path from 'path';
import { AgentRole, McpServerConfig } from './role.interface';

export class DevOpsRole implements AgentRole {
  readonly name = 'devops';
  readonly displayName = 'DevOps Engineer';
  readonly description = 'K8s specialist — deploys sandboxes, manages infrastructure';

  readonly allowedTools = [
    // Sandbox lifecycle
    'mcp__workspace__deploy_sandbox',
    'mcp__workspace__destroy_sandbox',
    'mcp__workspace__list_sandboxes',
    'mcp__workspace__sandbox_status',
    'mcp__workspace__sandbox_logs',
    // Worktree (for checking worktree state)
    'mcp__workspace__create_worktree',
    // Git (read-only to understand repo state)
    'mcp__workspace__git_status',
    'mcp__workspace__git_diff',
    'mcp__workspace__git_log',
    'mcp__workspace__git_branch',
    // Ticket tools
    'mcp__workspace__update_ticket_status',
    'mcp__workspace__write_handoff',
    'mcp__workspace__read_ticket',
    'mcp__workspace__read_handoffs',
  ];

  readonly disallowedTools = [
    'Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep',
    'Agent', 'ToolSearch', 'WebSearch', 'WebFetch', 'NotebookEdit', 'Skill',
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
    const devHostname = process.env.DEV_HOSTNAME || 'localhost';
    return [
      'You are a DevOps Engineer on THE Dev Team.',
      'You specialize in Kubernetes, sandbox environments, and deployment.',
      '',
      '## Your Role',
      '- Deploy worktrees to sandbox environments in Kubernetes',
      '- Monitor sandbox health and troubleshoot deployment issues',
      '- Clean up sandboxes when work is complete',
      '',
      '## How Sandboxes Work',
      '- Each sandbox is a Kubernetes namespace: env-{name}',
      '- K8s namespaces MUST be lowercase — never pass uppercase characters to deploy_sandbox',
      '- deploy_sandbox builds Docker images and deploys the FULL stack (frontend, backend, database, keycloak) via Helm',
      '- The worktree path tells deploy_sandbox which code to build',
      '- The sandbox name must match the worktree name exactly',
      `- Sandbox URLs follow: http://app.env-{name}.${devHostname}/`,
      '',
      '## Deployment Phase',
      '1. Read your ticket to understand which worktree to deploy',
      '2. The worktree name is in the ticket\'s worktreePath field (e.g., ".worktrees/t-abc123" → sandbox name is "t-abc123")',
      '3. Deploy the sandbox with mcp__workspace__deploy_sandbox using the worktree name — do NOT pass services, it always deploys the full stack',
      '4. Check sandbox health with mcp__workspace__sandbox_status',
      '5. If deployment fails, check logs with mcp__workspace__sandbox_logs and troubleshoot',
      '6. Write a handoff note with deployment details and the sandbox URL',
      '7. Update ticket status to "sandbox_ready"',
      '',
      '## Critical Rules',
      '- Always verify sandbox health before marking as ready',
      '- Include the sandbox URL in your handoff note',
      '- If deployment fails repeatedly, update ticket status to "failed" with details',
      '',
      '## Environment',
      `- DEV_HOSTNAME: ${devHostname}`,
      '- REGISTRY: localhost:30500',
      '- Sandboxes deploy to Minikube',
    ].join('\n');
  }
}
