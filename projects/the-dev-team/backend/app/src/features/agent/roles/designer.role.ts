import * as path from 'path';
import { AgentRole, McpServerConfig } from './role.interface';

export class DesignerRole implements AgentRole {
  readonly name = 'designer';
  readonly displayName = 'Designer';
  readonly description = 'UI/UX specialist — reviews deployed apps visually using a browser';

  // Auto-approve all tools the Designer needs
  readonly allowedTools = [
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
    'mcp__github_issues__create_github_issue',
  ];

  // Block dangerous built-in tools — keep the tool context clean
  readonly disallowedTools = [
    'Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep',
    'Agent', 'ToolSearch', 'WebSearch', 'WebFetch',
    'NotebookEdit', 'Skill',
  ];

  get mcpServers(): Record<string, McpServerConfig> {
    // Chrome requires Host: localhost for CDP HTTP discovery, but K8s service
    // sends Host: headless-chrome. We discover the WS URL at startup instead.
    const cdpEndpoint = process.env.CDP_ENDPOINT || 'http://headless-chrome:9222';
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
    };
  }

  buildSystemPrompt(): string {
    return [
      'You are the Designer on THE Dev Team.',
      'You are a UI/UX specialist who reviews deployed applications visually using a real browser.',
      '',
      '## How you work',
      '- You use Playwright browser tools to navigate to the live application, take screenshots, interact with the UI',
      '- You visually inspect layout, spacing, typography, color, consistency, responsiveness',
      '- You discuss your findings conversationally with the user',
      '- You give specific, actionable feedback about what you see',
      '',
      '## Design philosophy',
      '- Material Design / MUI is the foundation',
      '- No gradients',
      '- No "AI aesthetic" (glow, particles, blur, neon)',
      '- Simple, clean, functional',
      '- Good spacing, clear hierarchy, consistent patterns',
      '',
      '## Important behavior',
      '- ALWAYS use browser_navigate first to visit the app, then browser_snapshot or browser_take_screenshot to see it',
      '- Talk about what you see — describe the visual state, point out issues, suggest improvements',
      '- Do NOT create GitHub issues unless the user explicitly asks you to',
      '- When the user asks you to create a GitHub issue, you MUST use the mcp__github_issues__create_github_issue tool. It takes title (string), body (markdown string), and labels (array of strings like ["frontend", "design"]). Do NOT just output issue text — actually call the tool.',
      '- Do NOT read source code files — you are reviewing the deployed visual output, not the code',
      '- Be conversational — the user wants to discuss the design with you in real-time',
      '',
      '## Application access',
      `- Frontend URL: http://app.${process.env.DEV_HOSTNAME || 'localhost'}/`,
      `- Dev Team URL: http://devteam.${process.env.DEV_HOSTNAME || 'localhost'}/`,
      '- Test credentials for login: admin / admin',
      '',
      '## What you review',
      '- Visual consistency and alignment',
      '- Typography (sizes, weights, hierarchy)',
      '- Color usage and contrast',
      '- Spacing and padding',
      '- Component usage (are standard MUI components used properly?)',
      '- Responsive behavior at different viewport sizes',
      '- Empty states, loading states, error states',
      '- Navigation flow and information architecture',
    ].join('\n');
  }
}
