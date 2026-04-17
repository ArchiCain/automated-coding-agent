#!/usr/bin/env node

/**
 * MCP Server for THE Dev Team workspace operations.
 *
 * Exposes Taskfile commands as structured tools that Claude Code and
 * OpenCode can call natively — no bash guessing required.
 *
 * Speaks MCP protocol over stdio. Claude Code SDK spawns this as a
 * subprocess and discovers the tools automatically.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const execFile = promisify(execFileCb);

const REPO_ROOT = process.env.REPO_ROOT || '/workspace';
const REGISTRY = process.env.REGISTRY || 'localhost:30500';

// Always read the latest token from .git-credentials. The backend's
// GitHubTokenService refreshes that file every 50 minutes; reading it
// fresh on every call ensures the MCP subprocess never works with a
// stale token. Cheap operation (small file, on local FS).
function ensureGhToken(): void {
  try {
    const home = process.env.HOME || '/home/agent';
    const creds = fs.readFileSync(`${home}/.git-credentials`, 'utf-8').trim();
    const match = creds.match(/x-access-token:([^@]+)@/);
    if (match) {
      process.env.GH_TOKEN = match[1];
      process.env.GITHUB_TOKEN = match[1];
    }
  } catch {
    // ignore — gh will fail loudly if token is needed
  }
}
ensureGhToken();

async function runCommand(
  command: string,
  args: string[],
  cwd?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  // Refresh GH token before any gh/git command — token may have rotated since spawn
  if (command === 'gh' || command === 'git') {
    ensureGhToken();
  }
  try {
    const { stdout, stderr } = await execFile(command, args, {
      cwd: cwd || REPO_ROOT,
      timeout: 600_000, // 10 min max
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, REPO_ROOT },
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: err.stdout || '',
      stderr: err.stderr || String(error),
      exitCode: err.code || 1,
    };
  }
}

async function runTask(taskName: string, vars: Record<string, string> = {}): Promise<string> {
  // Taskfile syntax: task TASKNAME VAR1=val1 VAR2=val2
  const args: string[] = [taskName];
  for (const [key, value] of Object.entries(vars)) {
    args.push(`${key}=${value}`);
  }
  const result = await runCommand('task', args, REPO_ROOT);
  if (result.exitCode !== 0) {
    return `Error (exit ${result.exitCode}):\n${result.stderr}\n${result.stdout}`;
  }
  return result.stdout;
}

const server = new McpServer({
  name: 'workspace',
  version: '1.0.0',
});

// ── Tool: create_worktree ──────────────────────────────────────────

server.tool(
  'create_worktree',
  'Create a git worktree with a new branch for isolated development. The branch is created from the environment branch (local-scain by default). The worktree is a full copy of the repo at a separate path.',
  {
    name: z.string().describe('Short name for the worktree/branch (e.g., "t-abc123"). Must be lowercase.'),
    branchPrefix: z.string().optional().describe('Branch prefix (default: "ticket"). Creates branch as prefix/name.'),
    baseBranch: z.string().optional().describe('Base branch to fork from (default: "local-scain")'),
  },
  async ({ name, branchPrefix, baseBranch }) => {
    const prefix = branchPrefix || 'ticket';
    const branch = `${prefix}/${name}`;
    const base = baseBranch || 'local-scain';
    const worktreePath = `${REPO_ROOT}/.worktrees/${name}`;

    // Refresh remote ref
    const fetchResult = await runCommand('git', ['fetch', 'origin', base]);
    if (fetchResult.exitCode !== 0) {
      return { content: [{ type: 'text' as const, text: `Failed to fetch origin/${base}: ${fetchResult.stderr}` }] };
    }

    // Create the worktree branched from the base
    const result = await runCommand('git', [
      'worktree', 'add', '-b', branch, worktreePath, `origin/${base}`,
    ]);

    if (result.exitCode !== 0) {
      // Branch may already exist — try checking it out instead
      const retry = await runCommand('git', [
        'worktree', 'add', worktreePath, branch,
      ]);
      if (retry.exitCode !== 0) {
        return { content: [{ type: 'text' as const, text: `Failed to create worktree: ${retry.stderr}` }] };
      }
    }

    return {
      content: [{
        type: 'text' as const,
        text: [
          `Worktree created:`,
          `  Path: ${worktreePath}`,
          `  Branch: ${branch}`,
          `  Based on: origin/${base}`,
          ``,
          `Work in this directory. When ready, use deploy_sandbox to test or push_and_pr to submit.`,
        ].join('\n'),
      }],
    };
  },
);

// ── Tool: deploy_sandbox ───────────────────────────────────────────

server.tool(
  'deploy_sandbox',
  'Build Docker images from a worktree and deploy a full sandbox environment (backend, frontend, database, keycloak) to a new K8s namespace. Always deploys the complete stack so login and full testing work.',
  {
    name: z.string().describe('Sandbox name — must match a worktree name (e.g., "add-users-endpoint"). Must be lowercase and K8s-safe.'),
  },
  async ({ name }) => {
    const output = await runTask('env:deploy', {
      NAME: name,
      WORKTREE: `${REPO_ROOT}/.worktrees/${name}`,
      REGISTRY,
    });
    return { content: [{ type: 'text' as const, text: output }] };
  },
);

// ── Tool: destroy_sandbox ──────────────────────────────────────────

server.tool(
  'destroy_sandbox',
  'Tear down a sandbox environment — removes the K8s namespace, Helm release, and all pods.',
  {
    name: z.string().describe('Sandbox name to destroy'),
  },
  async ({ name }) => {
    const output = await runTask('env:destroy', { TASK_ID: name });
    return { content: [{ type: 'text' as const, text: output || `Sandbox env-${name} destroyed.` }] };
  },
);

// ── Tool: list_sandboxes ───────────────────────────────────────────

server.tool(
  'list_sandboxes',
  'List all active sandbox environments with their age and status.',
  {},
  async () => {
    const output = await runTask('env:list');
    return { content: [{ type: 'text' as const, text: output || 'No active sandboxes.' }] };
  },
);

// ── Tool: sandbox_status ───────────────────────────────────────────

server.tool(
  'sandbox_status',
  'Check the health and pod status of a sandbox environment.',
  {
    name: z.string().describe('Sandbox name to check'),
  },
  async ({ name }) => {
    const output = await runTask('env:health', { TASK_ID: name });
    return { content: [{ type: 'text' as const, text: output }] };
  },
);

// ── Tool: sandbox_logs ─────────────────────────────────────────────

server.tool(
  'sandbox_logs',
  'View recent logs from a service in a sandbox environment.',
  {
    name: z.string().describe('Sandbox name'),
    service: z.string().describe('Service name (e.g., "backend", "frontend")'),
  },
  async ({ name, service }) => {
    const result = await runCommand('kubectl', [
      'logs', '-n', `env-${name}`,
      `deployment/env-${name}-${service}`,
      '--tail=100',
    ]);
    return { content: [{ type: 'text' as const, text: result.stdout || result.stderr }] };
  },
);

// ── Tool: push_and_pr ──────────────────────────────────────────────

server.tool(
  'push_and_pr',
  'Commit all changes, push the branch to origin, and create a new DRAFT pull request (default). The Designer agent reviews the draft PR\'s sandbox and leaves PR review feedback. The PR stays in draft until you call mark_pr_ready (typically after Designer approves). One PR per issue — every issue gets its own branch, sandbox, and PR. closesIssue adds "Closes #N" so the issue auto-closes when the PR eventually merges.',
  {
    title: z.string().describe('PR title'),
    description: z.string().optional().describe('PR description/body (markdown)'),
    base: z.string().optional().describe('Base branch for the PR (default: "local-scain"). Agent PRs should target the environment branch, not main.'),
    closesIssue: z.number().optional().describe('GitHub issue number this PR closes — adds "Closes #N" to the PR body so the issue auto-closes when the PR merges'),
    draft: z.boolean().optional().describe('Open the PR as a draft (default: true). Drafts cannot be merged; use mark_pr_ready to convert to ready-for-review when work is complete.'),
    worktree: z.string().optional().describe('Worktree path (auto-detected from current branch if not provided)'),
  },
  async ({ title, description, base, closesIssue, draft, worktree }) => {
    const cwd = worktree || process.cwd();

    // Get current branch
    const branchResult = await runCommand('git', ['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
    const branch = branchResult.stdout.trim();

    // Safety guard — never push to a protected branch. Agent-created
    // branches use `the-dev-team/` or `ticket/` prefixes.
    if (!branch.startsWith('the-dev-team/') && !branch.startsWith('ticket/')) {
      return { content: [{ type: 'text' as const, text: `Refusing to push: current branch "${branch}" is not an agent branch (the-dev-team/* or ticket/*). Create a worktree first with create_worktree.` }] };
    }

    // Stage all changes
    await runCommand('git', ['add', '-A'], cwd);

    // Commit
    const commitResult = await runCommand('git', [
      'commit', '-m', `feat: ${title}`,
    ], cwd);

    if (commitResult.exitCode !== 0 && !commitResult.stderr.includes('nothing to commit')) {
      return { content: [{ type: 'text' as const, text: `Commit failed: ${commitResult.stderr}` }] };
    }

    // Push
    const pushResult = await runCommand('git', [
      'push', '-u', 'origin', branch,
    ], cwd);

    if (pushResult.exitCode !== 0) {
      return { content: [{ type: 'text' as const, text: `Push failed: ${pushResult.stderr}` }] };
    }

    // Build PR body — append "Closes #N" if linking an issue
    let body = description || '';
    if (closesIssue) {
      body = body ? `${body}\n\nCloses #${closesIssue}` : `Closes #${closesIssue}`;
    }

    const isDraft = draft !== false; // default true
    const prArgs = [
      'pr', 'create',
      '--title', title,
      '--base', base || 'local-scain',
      '--head', branch,
    ];
    if (isDraft) prArgs.push('--draft');
    if (body) {
      prArgs.push('--body', body);
    }

    const prResult = await runCommand('gh', prArgs, cwd);

    if (prResult.exitCode !== 0) {
      return { content: [{ type: 'text' as const, text: `PR creation failed: ${prResult.stderr}\nBranch was pushed to: ${branch}` }] };
    }

    return {
      content: [{
        type: 'text' as const,
        text: [
          `Branch pushed and ${isDraft ? 'DRAFT ' : ''}PR created:`,
          `  Branch: ${branch}`,
          `  PR: ${prResult.stdout.trim()}`,
          closesIssue ? `  Will close issue #${closesIssue} on merge` : '',
          isDraft ? `  Draft — call mark_pr_ready when work is complete and approved` : '',
        ].filter(Boolean).join('\n'),
      }],
    };
  },
);

server.tool(
  'read_github_issue',
  'Read a GitHub issue by number — returns title, body, labels, state, and metadata.',
  {
    number: z.number().describe('GitHub issue number (e.g., 10)'),
  },
  async ({ number }) => {
    process.stderr.write(`[workspace MCP] read_github_issue #${number}, GH_TOKEN set: ${!!process.env.GH_TOKEN}\n`);
    ensureGhToken();
    const result = await runCommand('gh', [
      'issue', 'view', String(number),
      '--json', 'number,title,body,state,labels,author,createdAt,url',
    ]);
    process.stderr.write(`[workspace MCP] gh exit: ${result.exitCode}, stdout len: ${result.stdout.length}, stderr: ${result.stderr.slice(0, 200)}\n`);
    if (result.exitCode !== 0) {
      return { content: [{ type: 'text' as const, text: `Failed to read issue #${number}:\n${result.stderr}` }] };
    }
    return { content: [{ type: 'text' as const, text: result.stdout.trim() }] };
  },
);

server.tool(
  'comment_github_issue',
  'Add a comment to a GitHub issue — useful for posting progress updates or noting that work has been deployed.',
  {
    number: z.number().describe('GitHub issue number'),
    body: z.string().describe('Comment body (markdown)'),
  },
  async ({ number, body }) => {
    const result = await runCommand('gh', [
      'issue', 'comment', String(number),
      '--body', body,
    ]);
    if (result.exitCode !== 0) {
      return { content: [{ type: 'text' as const, text: `Failed to comment on issue #${number}:\n${result.stderr}` }] };
    }
    return { content: [{ type: 'text' as const, text: result.stdout.trim() }] };
  },
);

// =========================================================================
// PR review tools — for the iteration workflow inside a single PR
// =========================================================================

server.tool(
  'read_pr_reviews',
  'Read all reviews + general comments on a PR. Use this when picking up work on a draft PR that has feedback to address. Returns the full review/comment history.',
  {
    number: z.number().describe('GitHub PR number'),
  },
  async ({ number }) => {
    const result = await runCommand('gh', [
      'pr', 'view', String(number),
      '--json', 'number,title,state,isDraft,reviews,comments,headRefName,headRefOid',
    ]);
    if (result.exitCode !== 0) {
      return { content: [{ type: 'text' as const, text: `Failed to read PR #${number}:\n${result.stderr}` }] };
    }
    return { content: [{ type: 'text' as const, text: result.stdout.trim() }] };
  },
);

server.tool(
  'review_pr',
  'Submit a formal review on a PR — request_changes / approve / comment. The Designer uses this after reviewing a draft PR\'s sandbox. The body should be specific and actionable. event="REQUEST_CHANGES" triggers the FE Owner to iterate; event="APPROVE" signals the work is done.',
  {
    number: z.number().describe('GitHub PR number'),
    event: z.enum(['REQUEST_CHANGES', 'APPROVE', 'COMMENT']).describe('Review verdict'),
    body: z.string().describe('Review body (markdown) — list specific changes needed, or note approval reasons'),
  },
  async ({ number, event, body }) => {
    const flag = event === 'REQUEST_CHANGES' ? '--request-changes' : event === 'APPROVE' ? '--approve' : '--comment';
    const result = await runCommand('gh', [
      'pr', 'review', String(number),
      flag,
      '--body', body,
    ]);
    if (result.exitCode !== 0) {
      return { content: [{ type: 'text' as const, text: `Failed to submit review on PR #${number}:\n${result.stderr}` }] };
    }
    return { content: [{ type: 'text' as const, text: `Review submitted on PR #${number} (${event}).` }] };
  },
);

server.tool(
  'comment_pr',
  'Post a general comment on a PR (not a formal review). Useful for posting status updates like "addressed feedback, please re-review".',
  {
    number: z.number().describe('GitHub PR number'),
    body: z.string().describe('Comment body (markdown)'),
  },
  async ({ number, body }) => {
    const result = await runCommand('gh', [
      'pr', 'comment', String(number),
      '--body', body,
    ]);
    if (result.exitCode !== 0) {
      return { content: [{ type: 'text' as const, text: `Failed to comment on PR #${number}:\n${result.stderr}` }] };
    }
    return { content: [{ type: 'text' as const, text: result.stdout.trim() }] };
  },
);

server.tool(
  'mark_pr_ready',
  'Convert a draft PR to ready-for-review. Call this when the Designer has approved the work and the PR is ready for human merge.',
  {
    number: z.number().describe('GitHub PR number'),
  },
  async ({ number }) => {
    const result = await runCommand('gh', [
      'pr', 'ready', String(number),
    ]);
    if (result.exitCode !== 0) {
      return { content: [{ type: 'text' as const, text: `Failed to mark PR #${number} ready:\n${result.stderr}` }] };
    }
    return { content: [{ type: 'text' as const, text: `PR #${number} marked ready for review.` }] };
  },
);

// =========================================================================
// Git tools — structured git operations (replaces Bash for git)
// =========================================================================

server.tool(
  'git_status',
  'Show the working tree status — modified, staged, and untracked files.',
  {
    cwd: z.string().optional().describe('Working directory (defaults to repo root)'),
  },
  async ({ cwd }) => {
    const result = await runCommand('git', ['status', '--short'], cwd || REPO_ROOT);
    const branch = await runCommand('git', ['rev-parse', '--abbrev-ref', 'HEAD'], cwd || REPO_ROOT);
    return {
      content: [{
        type: 'text' as const,
        text: `Branch: ${branch.stdout.trim()}\n\n${result.stdout || 'Working tree clean.'}`,
      }],
    };
  },
);

server.tool(
  'git_diff',
  'Show changes in the working tree or between commits.',
  {
    path: z.string().optional().describe('File or directory to diff (defaults to all)'),
    staged: z.boolean().optional().describe('Show staged changes only'),
    cwd: z.string().optional().describe('Working directory'),
  },
  async ({ path: diffPath, staged, cwd }) => {
    const args = ['diff'];
    if (staged) args.push('--cached');
    if (diffPath) args.push(diffPath);
    const result = await runCommand('git', args, cwd || REPO_ROOT);
    return { content: [{ type: 'text' as const, text: result.stdout || 'No differences.' }] };
  },
);

server.tool(
  'git_log',
  'Show recent commit history.',
  {
    count: z.number().optional().describe('Number of commits to show (default 10)'),
    oneline: z.boolean().optional().describe('One line per commit (default true)'),
    cwd: z.string().optional().describe('Working directory'),
  },
  async ({ count, oneline, cwd }) => {
    const args = ['log', `-${count || 10}`];
    if (oneline !== false) args.push('--oneline');
    const result = await runCommand('git', args, cwd || REPO_ROOT);
    return { content: [{ type: 'text' as const, text: result.stdout }] };
  },
);

server.tool(
  'git_checkout',
  'Switch branches or create a new branch.',
  {
    branch: z.string().describe('Branch name to switch to or create'),
    create: z.boolean().optional().describe('Create the branch if it does not exist'),
    cwd: z.string().optional().describe('Working directory'),
  },
  async ({ branch, create, cwd }) => {
    const args = ['checkout'];
    if (create) args.push('-b');
    args.push(branch);
    const result = await runCommand('git', args, cwd || REPO_ROOT);
    if (result.exitCode !== 0) {
      return { content: [{ type: 'text' as const, text: `Checkout failed: ${result.stderr}` }] };
    }
    return { content: [{ type: 'text' as const, text: `Switched to branch: ${branch}` }] };
  },
);

server.tool(
  'git_add',
  'Stage files for commit.',
  {
    paths: z.string().describe('Files to stage — space-separated, or "." for all'),
    cwd: z.string().optional().describe('Working directory'),
  },
  async ({ paths, cwd }) => {
    const args = ['add', ...paths.split(/\s+/)];
    const result = await runCommand('git', args, cwd || REPO_ROOT);
    if (result.exitCode !== 0) {
      return { content: [{ type: 'text' as const, text: `Add failed: ${result.stderr}` }] };
    }
    return { content: [{ type: 'text' as const, text: `Staged: ${paths}` }] };
  },
);

server.tool(
  'git_commit',
  'Commit staged changes with a message.',
  {
    message: z.string().describe('Commit message (use conventional format: feat:, fix:, etc.)'),
    cwd: z.string().optional().describe('Working directory'),
  },
  async ({ message, cwd }) => {
    const result = await runCommand('git', ['commit', '-m', message], cwd || REPO_ROOT);
    if (result.exitCode !== 0) {
      return { content: [{ type: 'text' as const, text: `Commit failed: ${result.stderr}` }] };
    }
    return { content: [{ type: 'text' as const, text: result.stdout.trim() }] };
  },
);

server.tool(
  'git_push',
  'Push the current branch to the remote repository.',
  {
    branch: z.string().optional().describe('Branch name (defaults to current branch)'),
    setUpstream: z.boolean().optional().describe('Set upstream tracking (default true for new branches)'),
    cwd: z.string().optional().describe('Working directory'),
  },
  async ({ branch, setUpstream, cwd }) => {
    const args = ['push'];
    if (setUpstream !== false) args.push('-u');
    args.push('origin');
    if (branch) args.push(branch);
    const result = await runCommand('git', args, cwd || REPO_ROOT);
    if (result.exitCode !== 0) {
      return { content: [{ type: 'text' as const, text: `Push failed: ${result.stderr}` }] };
    }
    return { content: [{ type: 'text' as const, text: `Pushed successfully.\n${result.stderr}` }] };
  },
);

server.tool(
  'git_pull',
  'Pull latest changes from the remote.',
  {
    cwd: z.string().optional().describe('Working directory'),
  },
  async ({ cwd }) => {
    const result = await runCommand('git', ['pull'], cwd || REPO_ROOT);
    return { content: [{ type: 'text' as const, text: result.stdout || result.stderr }] };
  },
);

server.tool(
  'git_stash',
  'Stash or restore uncommitted changes.',
  {
    action: z.enum(['push', 'pop', 'list', 'drop']).describe('Stash action'),
    message: z.string().optional().describe('Stash message (for push)'),
    cwd: z.string().optional().describe('Working directory'),
  },
  async ({ action, message, cwd }) => {
    const args = ['stash', action];
    if (action === 'push' && message) args.push('-m', message);
    const result = await runCommand('git', args, cwd || REPO_ROOT);
    return { content: [{ type: 'text' as const, text: result.stdout || result.stderr || `Stash ${action} complete.` }] };
  },
);

server.tool(
  'git_branch',
  'List, create, or delete branches.',
  {
    action: z.enum(['list', 'create', 'delete']).optional().describe('Action (default: list)'),
    name: z.string().optional().describe('Branch name (for create/delete)'),
    cwd: z.string().optional().describe('Working directory'),
  },
  async ({ action, name, cwd }) => {
    const act = action || 'list';
    if (act === 'list') {
      const result = await runCommand('git', ['branch', '-a'], cwd || REPO_ROOT);
      return { content: [{ type: 'text' as const, text: result.stdout }] };
    }
    if (act === 'create' && name) {
      const result = await runCommand('git', ['branch', name], cwd || REPO_ROOT);
      return { content: [{ type: 'text' as const, text: result.exitCode === 0 ? `Branch ${name} created.` : result.stderr }] };
    }
    if (act === 'delete' && name) {
      const result = await runCommand('git', ['branch', '-d', name], cwd || REPO_ROOT);
      return { content: [{ type: 'text' as const, text: result.exitCode === 0 ? `Branch ${name} deleted.` : result.stderr }] };
    }
    return { content: [{ type: 'text' as const, text: 'Invalid branch action.' }] };
  },
);

// ── Tool: create_github_issue ─────────────────────────────────────

server.tool(
  'create_github_issue',
  'Create a GitHub issue in the repository. Use labels to route to the right team member.',
  {
    title: z.string().describe('Issue title'),
    body: z.string().describe('Issue body (markdown)'),
    labels: z.array(z.string()).optional().describe('Labels (e.g. ["frontend", "design", "bug"])'),
  },
  async ({ title, body, labels }) => {
    const args = ['issue', 'create', '--title', title, '--body', body];
    if (labels && labels.length > 0) {
      for (const label of labels) {
        args.push('--label', label);
      }
    }
    const result = await runCommand('gh', args, REPO_ROOT);
    if (result.exitCode !== 0) {
      return { content: [{ type: 'text' as const, text: `Failed to create issue:\n${result.stderr}` }] };
    }
    return { content: [{ type: 'text' as const, text: result.stdout.trim() }] };
  },
);

// =========================================================================
// Ticket tools — agents interact with the ticket system through these
// =========================================================================

const TICKETS_DIR = path.join(REPO_ROOT, '.dev-team', 'tickets');

/** Valid transitions agents are allowed to set */
const AGENT_SETTABLE_STATUSES = [
  'ready_for_sandbox', 'pr_open', 'sandbox_ready',
  'code_review_passed', 'code_review_changes_needed',
  'approved', 'design_changes_needed', 'failed',
] as const;

/** Valid transitions from each status (subset for agent validation) */
const AGENT_TRANSITIONS: Record<string, string[]> = {
  in_progress: ['ready_for_sandbox', 'failed'],
  sandbox_deploying: ['sandbox_ready', 'failed'],
  self_testing: ['pr_open', 'in_progress', 'failed'],
  code_reviewing: ['code_review_passed', 'code_review_changes_needed', 'failed'],
  design_reviewing: ['approved', 'design_changes_needed', 'failed'],
};

function readTicketFile(ticketId: string): Record<string, unknown> | null {
  const ticketPath = path.join(TICKETS_DIR, ticketId, 'ticket.json');
  if (!fs.existsSync(ticketPath)) return null;
  return JSON.parse(fs.readFileSync(ticketPath, 'utf-8'));
}

function writeTicketFile(ticketId: string, ticket: Record<string, unknown>): void {
  const dir = path.join(TICKETS_DIR, ticketId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'ticket.json'), JSON.stringify(ticket, null, 2));
}

server.tool(
  'update_ticket_status',
  'Update a ticket\'s status. Use this to report progress — e.g., "ready_for_sandbox" when implementation is done, "pr_open" after creating a PR, "failed" on unrecoverable error. Always write a handoff note before updating status.',
  {
    ticketId: z.string().describe('Ticket ID (e.g., "T-4a2b1c")'),
    status: z.enum(AGENT_SETTABLE_STATUSES).describe('New status'),
    prNumber: z.number().optional().describe('PR number (required when setting status to "pr_open")'),
    detail: z.string().optional().describe('Context for the transition'),
  },
  async ({ ticketId, status, prNumber, detail }) => {
    const ticket = readTicketFile(ticketId);
    if (!ticket) {
      return { content: [{ type: 'text' as const, text: `Ticket ${ticketId} not found.` }] };
    }

    const currentStatus = ticket.status as string;
    const allowed = AGENT_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(status)) {
      return { content: [{ type: 'text' as const, text: `Invalid transition: ${currentStatus} → ${status}. Allowed from ${currentStatus}: ${allowed?.join(', ') || 'none'}` }] };
    }

    const now = new Date().toISOString();
    ticket.status = status;
    ticket.updatedAt = now;
    if (prNumber) ticket.prNumber = prNumber;
    const history = ticket.history as Array<Record<string, unknown>>;
    history.push({ status, at: now, trigger: 'agent', detail });

    writeTicketFile(ticketId, ticket);
    return { content: [{ type: 'text' as const, text: `Ticket ${ticketId}: ${currentStatus} → ${status}` }] };
  },
);

server.tool(
  'write_handoff',
  'Write a handoff note for the current ticket. Include what you did, what\'s not done, gotchas, and recommendations for the next agent. ALWAYS call this before updating ticket status.',
  {
    ticketId: z.string().describe('Ticket ID'),
    phase: z.string().describe('Current phase (e.g., "implementation", "deployment", "self_test", "code_review", "design_review", "iteration")'),
    content: z.string().describe('Handoff note content (markdown). Include: What I Did, What\'s Not Done, Gotchas, For Next Agent sections.'),
  },
  async ({ ticketId, phase, content }) => {
    const ticket = readTicketFile(ticketId);
    if (!ticket) {
      return { content: [{ type: 'text' as const, text: `Ticket ${ticketId} not found.` }] };
    }

    const handoffsDir = path.join(TICKETS_DIR, ticketId, 'handoffs');
    fs.mkdirSync(handoffsDir, { recursive: true });

    const existing = fs.readdirSync(handoffsDir).filter((f) => f.endsWith('.md'));
    const seq = String(existing.length + 1).padStart(3, '0');
    const filename = `${seq}-${phase}.md`;

    const agent = ticket.activeAgent as Record<string, unknown> | null;
    const frontmatter = [
      '---',
      `agent: ${agent?.name || 'unknown'}`,
      `role: ${agent?.role || 'unknown'}`,
      `phase: ${phase}`,
      `ticket: ${ticketId}`,
      `at: ${new Date().toISOString()}`,
      '---',
      '',
    ].join('\n');

    fs.writeFileSync(path.join(handoffsDir, filename), frontmatter + content);
    return { content: [{ type: 'text' as const, text: `Handoff note written: ${filename}` }] };
  },
);

server.tool(
  'read_ticket',
  'Read the full details of a ticket — status, history, active agent, dependencies, workspace info.',
  {
    ticketId: z.string().describe('Ticket ID'),
  },
  async ({ ticketId }) => {
    const ticket = readTicketFile(ticketId);
    if (!ticket) {
      return { content: [{ type: 'text' as const, text: `Ticket ${ticketId} not found.` }] };
    }
    return { content: [{ type: 'text' as const, text: JSON.stringify(ticket, null, 2) }] };
  },
);

server.tool(
  'read_handoffs',
  'Read all handoff notes for a ticket — chronological context from every agent that worked on it.',
  {
    ticketId: z.string().describe('Ticket ID'),
  },
  async ({ ticketId }) => {
    const handoffsDir = path.join(TICKETS_DIR, ticketId, 'handoffs');
    if (!fs.existsSync(handoffsDir)) {
      return { content: [{ type: 'text' as const, text: 'No handoff notes yet.' }] };
    }
    const files = fs.readdirSync(handoffsDir).filter((f) => f.endsWith('.md')).sort();
    if (files.length === 0) {
      return { content: [{ type: 'text' as const, text: 'No handoff notes yet.' }] };
    }
    const notes = files.map((f) => {
      const content = fs.readFileSync(path.join(handoffsDir, f), 'utf-8');
      return `=== ${f} ===\n${content}`;
    }).join('\n\n');
    return { content: [{ type: 'text' as const, text: notes }] };
  },
);

server.tool(
  'list_tickets',
  'List all tickets, optionally filtered by status, role, or plan. Returns a summary of each ticket.',
  {
    status: z.string().optional().describe('Filter by status (e.g., "in_progress", "queued")'),
    role: z.string().optional().describe('Filter by assigned role (e.g., "frontend-developer")'),
    planId: z.string().optional().describe('Filter by plan ID'),
  },
  async ({ status, role, planId }) => {
    if (!fs.existsSync(TICKETS_DIR)) {
      return { content: [{ type: 'text' as const, text: 'No tickets directory found.' }] };
    }
    const entries = fs.readdirSync(TICKETS_DIR, { withFileTypes: true });
    const tickets: Array<Record<string, unknown>> = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const ticketFile = path.join(TICKETS_DIR, entry.name, 'ticket.json');
      if (!fs.existsSync(ticketFile)) continue;
      try {
        const ticket = JSON.parse(fs.readFileSync(ticketFile, 'utf-8'));
        if (status && ticket.status !== status) continue;
        if (role && ticket.assignedRole !== role) continue;
        if (planId && ticket.planId !== planId) continue;
        tickets.push(ticket);
      } catch { /* skip malformed */ }
    }
    if (tickets.length === 0) {
      return { content: [{ type: 'text' as const, text: 'No tickets match the filter.' }] };
    }
    const summary = tickets.map((t) => {
      const agent = t.activeAgent as Record<string, unknown> | null;
      return `${t.id} | ${t.status} | ${t.assignedRole} | ${agent?.name || '-'} | ${t.title}`;
    }).join('\n');
    return { content: [{ type: 'text' as const, text: `ID | Status | Role | Agent | Title\n${'-'.repeat(60)}\n${summary}` }] };
  },
);

server.tool(
  'create_ticket',
  'Create a new ticket from a decomposed task specification. Only the Team Lead should use this. The ticket will be automatically picked up by the ticket engine when its dependencies are met.',
  {
    title: z.string().describe('Human-readable ticket title'),
    specPath: z.string().describe('Path to the task.md spec file, relative to repo root'),
    planId: z.string().describe('Plan ID this ticket belongs to (e.g., "p-a3f1b2")'),
    assignedRole: z.enum(['frontend-developer', 'designer', 'devops', 'code-reviewer']).describe('Which agent role should work this'),
    priority: z.enum(['critical', 'high', 'medium', 'low']).describe('Priority level'),
    dependsOn: z.array(z.string()).optional().describe('Array of ticket IDs that must complete first'),
    targetBranch: z.string().optional().describe('Target branch for PRs (default: "local-scain")'),
  },
  async ({ title, specPath, planId, assignedRole, priority, dependsOn, targetBranch }) => {
    const id = `t-${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date().toISOString();
    const ticket = {
      id,
      title,
      specPath,
      planId,
      status: 'created',
      assignedRole,
      activeAgent: null,
      agentHistory: [],
      dependsOn: dependsOn || [],
      priority,
      branch: null,
      worktreePath: null,
      sandboxNamespace: null,
      prNumber: null,
      targetBranch: targetBranch || 'local-scain',
      history: [{ status: 'created', at: now, trigger: 'team-lead' }],
      createdAt: now,
      updatedAt: now,
    };

    const dir = path.join(TICKETS_DIR, id);
    fs.mkdirSync(dir, { recursive: true });
    fs.mkdirSync(path.join(dir, 'handoffs'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'ticket.json'), JSON.stringify(ticket, null, 2));

    return { content: [{ type: 'text' as const, text: `Ticket created: ${id} — "${title}" (${assignedRole}, ${priority})` }] };
  },
);

// ── Start server ───────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('MCP server failed:', err);
  process.exit(1);
});
