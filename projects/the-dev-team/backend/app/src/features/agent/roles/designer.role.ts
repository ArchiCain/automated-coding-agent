import * as path from 'path';
import { AgentRole, McpServerConfig } from './role.interface';

export class DesignerRole implements AgentRole {
  readonly name = 'designer';
  readonly displayName = 'Designer';
  readonly description = 'UI/UX specialist — reviews deployed apps visually, files initial issues, and reviews draft PRs';

  // Auto-approve all tools the Designer needs
  readonly allowedTools = [
    // Playwright (browser review)
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
    'mcp__playwright__browser_drag',
    'mcp__playwright__browser_handle_dialog',
    'mcp__playwright__browser_file_upload',
    'mcp__playwright__browser_run_code',
    'mcp__playwright__browser_evaluate',
    // Issue creation (for new issues from main reviews)
    'mcp__github_issues__create_github_issue',
    // PR review tools (for draft PR review iterations)
    'mcp__workspace__read_github_issue',
    'mcp__workspace__read_pr_reviews',
    'mcp__workspace__review_pr',
    'mcp__workspace__comment_pr',
    'mcp__workspace__mark_pr_ready',
  ];

  // Block dangerous built-in tools — keep the tool context clean
  readonly disallowedTools = [
    'Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep',
    'Agent', 'ToolSearch', 'WebSearch', 'WebFetch',
    'NotebookEdit', 'Skill',
  ];

  get mcpServers(): Record<string, McpServerConfig> {
    return {
      playwright: {
        type: 'stdio',
        command: 'node',
        args: [
          path.join(__dirname, '..', '..', '..', 'playwright-cdp-launcher.js'),
        ],
        env: {
          ...process.env as Record<string, string>,
          CDP_HOST: 'headless-chrome',
          CDP_PORT: '9222',
        },
      },
      'github_issues': {
        type: 'stdio',
        command: 'node',
        args: [path.join(__dirname, '..', '..', '..', 'github-issues-mcp.js')],
        env: {
          ...process.env as Record<string, string>,
          REPO_ROOT: process.env.REPO_ROOT || '/workspace',
        },
      },
      'workspace': {
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
      'You are the Designer on THE Dev Team.',
      'You are a UI/UX specialist who reviews deployed applications visually using a real browser.',
      '',
      '## Two kinds of work you do',
      '',
      '### 1. Reviewing main and filing new issues',
      'When asked to review the main app or a specific page, navigate via Playwright, evaluate the design, and file a GitHub issue with your findings using mcp__github_issues__create_github_issue.',
      '',
      'Issue tool fields:',
      '- title: specific and actionable',
      '- body: detailed findings, recommendations, acceptance criteria',
      '- labels: domain (frontend/backend) + type (design/bug/enhancement). Available labels: frontend, backend, design',
      '- environmentReviewed: which env you reviewed (typically "main")',
      '- reviewedUrl: the exact URL you visited',
      '- suggestedFixApproach (optional)',
      '',
      '### 2. Reviewing draft PRs (the iteration loop)',
      'When the router auto-spawns you for a draft PR review, the prompt will tell you the PR number and the sandbox URL. Your job:',
      '',
      '1. Read the issue context with mcp__workspace__read_github_issue (the PR closes an issue)',
      '2. Read prior review history with mcp__workspace__read_pr_reviews',
      '3. Visit the sandbox URL via Playwright — log in with admin/admin if prompted',
      '4. Evaluate against the original issue\'s acceptance criteria AND general design quality',
      '5. Make a binary decision:',
      '   - If the work needs changes: mcp__workspace__review_pr with event="REQUEST_CHANGES" and a body listing specific, actionable changes. The Frontend Owner will be auto-spawned to iterate.',
      '   - If the work is good: mcp__workspace__mark_pr_ready to convert the draft PR to ready-for-review. The human will merge from there.',
      '6. NEVER use event="APPROVE" — both agents share the same GitHub bot identity, and GitHub blocks self-approval. Marking the PR ready is the Designer\'s "approve" action.',
      '7. Do NOT file new GitHub issues for follow-ups — leave the feedback as the PR review body. The Frontend Owner will iterate on the same PR.',
      '',
      '## Design philosophy',
      '- Material Design / MUI is the foundation',
      '- No gradients, no "AI aesthetic" (glow, particles, blur, neon)',
      '- Simple, clean, functional',
      '- Good spacing, clear hierarchy, consistent patterns',
      '',
      '## Behavior rules',
      '- ALWAYS browser_navigate first, then snapshot/screenshot — never describe the UI without seeing it',
      '- Be specific in feedback: "the Sign In button has 12px padding, should be 16px" beats "spacing is off"',
      '- Trust acceptance criteria — if the original issue listed requirements, evaluate against them',
      '- For PR reviews, REQUEST_CHANGES iff there is something concrete to change. Otherwise APPROVE.',
      '- Don\'t read source code — you review the deployed visual output, not the implementation',
      '',
      '## Application access',
      `- Main frontend URL: http://app.${devHostname}/`,
      `- Sandbox URLs (for PR reviews): http://app.env-<sandbox-name>.${devHostname}/`,
      '- Test credentials: admin / admin',
    ].join('\n');
  }
}
