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

const execFile = promisify(execFileCb);

const REPO_ROOT = process.env.REPO_ROOT || '/workspace';
const REGISTRY = process.env.REGISTRY || 'localhost:30500';

async function runCommand(
  command: string,
  args: string[],
  cwd?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
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
  const args = [taskName];
  for (const [key, value] of Object.entries(vars)) {
    args.push(`${key}=${value}`);
  }
  const result = await runCommand('task', args);
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
  'Create a git worktree with a new branch for isolated development. The worktree is a full copy of the repo at a separate path.',
  {
    name: z.string().describe('Short name for the worktree/branch (e.g., "add-users-endpoint")'),
  },
  async ({ name }) => {
    const branch = `the-dev-team/${name}`;
    const worktreePath = `${REPO_ROOT}/.worktrees/${name}`;
    const result = await runCommand('git', [
      'worktree', 'add', '-b', branch, worktreePath,
    ]);

    if (result.exitCode !== 0) {
      // Branch may already exist — try without -b
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
  'Build Docker images from a worktree and deploy a full sandbox environment (backend, frontend, database, keycloak) to a new K8s namespace. Use this to test your changes against a live system.',
  {
    name: z.string().describe('Sandbox name — must match a worktree name (e.g., "add-users-endpoint")'),
    services: z.string().optional().describe('Space-separated services to build (default: "backend frontend")'),
  },
  async ({ name, services }) => {
    const output = await runTask('env:deploy', {
      NAME: name,
      WORKTREE: `${REPO_ROOT}/.worktrees/${name}`,
      REGISTRY,
      ...(services ? { SERVICES: services } : {}),
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
  'Commit all changes, push the branch to origin, and create a pull request. Run this when your changes are ready for review.',
  {
    title: z.string().describe('PR title'),
    description: z.string().optional().describe('PR description/body'),
    worktree: z.string().optional().describe('Worktree path (auto-detected from current branch if not provided)'),
  },
  async ({ title, description, worktree }) => {
    const cwd = worktree || process.cwd();

    // Get current branch
    const branchResult = await runCommand('git', ['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
    const branch = branchResult.stdout.trim();

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

    // Create PR
    const prArgs = [
      'pr', 'create',
      '--title', title,
      '--base', 'main',
      '--head', branch,
    ];
    if (description) {
      prArgs.push('--body', description);
    }

    const prResult = await runCommand('gh', prArgs, cwd);

    if (prResult.exitCode !== 0) {
      return { content: [{ type: 'text' as const, text: `PR creation failed: ${prResult.stderr}\nBranch was pushed to: ${branch}` }] };
    }

    return {
      content: [{
        type: 'text' as const,
        text: [
          `Branch pushed and PR created:`,
          `  Branch: ${branch}`,
          `  PR: ${prResult.stdout.trim()}`,
        ].join('\n'),
      }],
    };
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

// ── Start server ───────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('MCP server failed:', err);
  process.exit(1);
});
