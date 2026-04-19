import * as path from 'path';
import { AgentRole, McpServerConfig } from './role.interface';

export class TeamLeadRole implements AgentRole {
  readonly name = 'team-lead';
  readonly displayName = 'Team Lead';
  readonly description = 'Orchestrator — decomposes work, monitors progress, visual verification';

  readonly allowedTools = [
    // File ops (read-only for reading specs, plans, docs + Write for creating task specs)
    'Read', 'Write', 'Glob', 'Grep',
    // Playwright (for visual verification)
    'mcp__playwright__browser_navigate',
    'mcp__playwright__browser_snapshot',
    'mcp__playwright__browser_take_screenshot',
    'mcp__playwright__browser_click',
    'mcp__playwright__browser_type',
    'mcp__playwright__browser_fill_form',
    'mcp__playwright__browser_hover',
    'mcp__playwright__browser_select_option',
    'mcp__playwright__browser_press_key',
    'mcp__playwright__browser_navigate_back',
    'mcp__playwright__browser_resize',
    'mcp__playwright__browser_tabs',
    'mcp__playwright__browser_close',
    'mcp__playwright__browser_wait_for',
    'mcp__playwright__browser_console_messages',
    'mcp__playwright__browser_network_requests',
  ];

  // Explicitly block everything that could let the Team Lead do implementation work
  readonly disallowedTools = [
    'Bash', 'Edit', 'Agent', 'ToolSearch', 'WebSearch', 'WebFetch', 'NotebookEdit', 'Skill',
    // Block ALL git tools — Team Lead should never touch git
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
    // Block implementation tools
    'mcp__workspace__push_and_pr',
    'mcp__workspace__create_worktree',
    'mcp__workspace__deploy_sandbox',
    'mcp__workspace__destroy_sandbox',
    'mcp__workspace__review_pr',
    'mcp__workspace__comment_pr',
    'mcp__workspace__mark_pr_ready',
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
      playwright: {
        type: 'stdio',
        command: 'node',
        args: [path.join(__dirname, '..', '..', '..', 'playwright-cdp-launcher.js')],
        env: {
          ...process.env as Record<string, string>,
          CDP_HOST: 'headless-chrome',
          CDP_PORT: '9222',
        },
      },
    };
  }

  buildSystemPrompt(): string {
    const devHostname = process.env.DEV_HOSTNAME || 'localhost';
    return [
      'You are the Team Lead on THE Dev Team.',
      'You orchestrate all development work by decomposing requirements into `.docs/` specifications.',
      '',
      '## CRITICAL: What You Do NOT Do',
      '- You NEVER write code, edit files, or make implementation changes',
      '- You NEVER create branches, worktrees, PRs, or push to git',
      '- You NEVER deploy sandboxes or manage infrastructure',
      '- You NEVER review PRs',
      '- You are a MANAGER, not a developer. You plan and your team does the work.',
      '',
      '## Your Role',
      '- Brainstorm with the user to understand requirements',
      '- Visually inspect the application using Playwright when the user describes issues',
      '- Decompose work into `.docs/` specifications',
      '- Answer questions about the project, architecture, and progress',
      '',
      '## Team Members (agent roles)',
      '- **frontend-owner**: Frontend specialist. Implements UI features, fixes bugs.',
      '- **backend-owner**: Backend specialist. Implements API features, fixes bugs.',
      '- **designer**: UI/UX specialist. Reviews code against design docs.',
      '- **devops**: K8s specialist. Deploys sandboxes, manages infrastructure.',
      '- **code-reviewer**: Code quality specialist. Reviews PRs for standards compliance.',
      '',
      '## Docs-Driven Decomposition',
      'When the user describes work:',
      '1. Understand the full scope — ask clarifying questions if needed',
      '2. Break into features (user-facing functionality)',
      '3. Write `.docs/requirements.md` for each feature',
      '4. The delta between docs and code defines the work for implementation agents',
      '',
      '## Visual Verification',
      'When the user says something looks wrong ("the nav is off", "spacing is broken"):',
      '1. Navigate to the relevant page using Playwright',
      '2. Take a screenshot to see what they mean',
      '3. Identify the issue and update the relevant `.docs/` spec',
      '',
      '## Application Access',
      `- Main frontend: http://app.${devHostname}/`,
      `- Sandbox pattern: http://app.env-<name>.${devHostname}/`,
      '- Test credentials: admin / admin',
    ].join('\n');
  }
}
