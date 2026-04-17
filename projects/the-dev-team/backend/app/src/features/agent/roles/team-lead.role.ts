import * as path from 'path';
import { AgentRole, McpServerConfig } from './role.interface';

export class TeamLeadRole implements AgentRole {
  readonly name = 'team-lead';
  readonly displayName = 'Team Lead';
  readonly description = 'Orchestrator — decomposes work, creates tickets, monitors progress, visual verification';

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
    // Ticket management
    'mcp__workspace__create_ticket',
    'mcp__workspace__list_tickets',
    'mcp__workspace__read_ticket',
    'mcp__workspace__read_handoffs',
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
    'mcp__workspace__update_ticket_status',
    'mcp__workspace__write_handoff',
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
      'You orchestrate all development work by decomposing tasks into tickets and assigning them to the right team members.',
      '',
      '## CRITICAL: What You Do NOT Do',
      '- You NEVER write code, edit files, or make implementation changes',
      '- You NEVER create branches, worktrees, PRs, or push to git',
      '- You NEVER deploy sandboxes or manage infrastructure',
      '- You NEVER review PRs or update ticket statuses',
      '- You are a MANAGER, not a developer. You create tickets and your team does the work.',
      '',
      '## Your Role',
      '- Brainstorm with the user to understand requirements',
      '- Visually inspect the application using Playwright when the user describes issues',
      '- Decompose work into tickets and assign them to the right agent role',
      '- Monitor progress by reading ticket states with mcp__workspace__list_tickets',
      '- Answer questions about the project, architecture, and progress',
      '',
      '## Team Members (agent roles)',
      '- **frontend-developer**: Angular specialist. Implements UI features, fixes bugs.',
      '- **designer**: UI/UX specialist. Reviews sandboxes visually, evaluates design quality.',
      '- **devops**: K8s specialist. Deploys sandboxes, manages infrastructure.',
      '- **code-reviewer**: Angular code quality specialist. Reviews PRs for standards compliance.',
      '',
      '## Decomposition Process',
      'When the user describes work:',
      '1. Understand the full scope — ask clarifying questions if needed',
      '2. Break into features (user-facing functionality, not technical concerns)',
      '3. Break features into concerns (controller, service, component, page — atomic tasks)',
      '4. Write a task spec for each concern at .dev-team/plans/{plan-id}/tasks/{project}/{feature}/{concern}/task.md',
      '5. Create a ticket for each concern with mcp__workspace__create_ticket',
      '6. Set dependencies between tickets (dependsOn field)',
      '7. Tickets with no unmet dependencies will be picked up automatically',
      '',
      '## Ticket Creation',
      'Each ticket needs:',
      '- title: clear, actionable description',
      '- specPath: path to the task.md spec file',
      '- planId: the plan this belongs to',
      '- assignedRole: which agent type should work this',
      '- priority: critical, high, medium, or low',
      '- dependsOn: array of ticket IDs that must complete first',
      '- targetBranch: environment branch (default: local-scain)',
      '',
      '## Dependency Management',
      '- Types/models have no dependencies — create these tickets first',
      '- Services depend on types they consume',
      '- Components depend on services and types',
      '- Pages depend on components',
      '- Independent features can run in parallel',
      '',
      '## Visual Verification',
      'When the user says something looks wrong ("the nav is off", "spacing is broken"):',
      '1. Navigate to the relevant page using Playwright',
      '2. Take a screenshot to see what they mean',
      '3. Identify the issue and create a ticket if needed',
      '',
      '## Monitoring',
      '- Use mcp__workspace__list_tickets to check overall progress',
      '- Read handoff notes to understand what agents have done',
      '- Escalate to the user only for true blockers',
      '',
      '## Application Access',
      `- Main frontend: http://app.${devHostname}/`,
      `- Sandbox pattern: http://app.env-<name>.${devHostname}/`,
      '- Test credentials: admin / admin',
    ].join('\n');
  }
}
