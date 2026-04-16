#!/usr/bin/env node

/**
 * Minimal MCP Server that only provides GitHub issue creation.
 * Used by the Designer agent to create issues without having access
 * to git, deploy, or other workspace tools.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as pathModule from 'path';

const execFile = promisify(execFileCb);
const REPO_ROOT = process.env.REPO_ROOT || '/workspace';

/** Find the gh binary — try PATH first, then common Nix locations */
function findGhBinary(): string {
  // Check if `gh` is in PATH (via env)
  const pathEnv = process.env.PATH || '';
  for (const dir of pathEnv.split(':')) {
    const candidate = pathModule.join(dir, 'gh');
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch { /* continue */ }
  }
  // Scan /nix/store for gh-*
  try {
    const entries = fs.readdirSync('/nix/store');
    for (const entry of entries) {
      if (entry.includes('gh-') || entry.includes('-gh')) {
        const candidate = `/nix/store/${entry}/bin/gh`;
        try {
          fs.accessSync(candidate, fs.constants.X_OK);
          return candidate;
        } catch { /* continue */ }
      }
    }
  } catch { /* ignore */ }
  return 'gh'; // fallback, will fail with ENOENT if not found
}

const GH_BIN = findGhBinary();

async function runCommand(
  command: string,
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await execFile(command, args, {
      cwd: REPO_ROOT,
      timeout: 30_000,
      maxBuffer: 1 * 1024 * 1024,
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

const server = new McpServer({
  name: 'github_issues',
  version: '1.0.0',
});

server.tool(
  'create_github_issue',
  'Create a GitHub issue in the repository. Labels are required for routing to the right agent. Environment context fields are appended to the body so the picking-up agent knows what was reviewed.',
  {
    title: z.string().describe('Issue title — be specific and actionable'),
    body: z.string().describe('Issue body (markdown) — describe the problem, what you observed, and recommendations'),
    labels: z.array(z.string()).min(1).describe('REQUIRED labels for routing. At minimum include a domain label (frontend, backend, devops) and a type label (design, bug, enhancement). Example: ["frontend", "design"]'),
    environmentReviewed: z.string().describe('The environment that was reviewed (e.g., "main", "sandbox-dark-mode") — required so the picking-up agent knows the context'),
    reviewedUrl: z.string().describe('The exact URL that was reviewed (e.g., "http://app.shawns-macbook-pro/login") — required so the picking-up agent can verify their fix in the same place'),
    suggestedFixApproach: z.string().optional().describe('Optional: suggest how/where to fix this (e.g., "Create a sandbox to redesign the login page without affecting main"). Helps the picking-up agent plan their work.'),
  },
  async ({ title, body, labels, environmentReviewed, reviewedUrl, suggestedFixApproach }) => {
    // Log to stderr so it shows up in backend logs
    process.stderr.write(`[github_issues MCP] Creating issue: ${title}\n`);

    // Format the body with env context appended at the bottom
    const contextSection = [
      '',
      '---',
      '## Context',
      `- **Environment reviewed**: \`${environmentReviewed}\``,
      `- **URL reviewed**: ${reviewedUrl}`,
      suggestedFixApproach ? `- **Suggested approach**: ${suggestedFixApproach}` : null,
    ].filter(Boolean).join('\n');

    const fullBody = `${body}\n${contextSection}`;

    // Ensure GH_TOKEN is available — read from git credentials if not in env
    if (!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN) {
      try {
        const fs = await import('fs');
        const home = process.env.HOME || '/home/agent';
        const creds = fs.readFileSync(`${home}/.git-credentials`, 'utf-8').trim();
        const match = creds.match(/x-access-token:([^@]+)@/);
        if (match) {
          process.env.GH_TOKEN = match[1];
          process.stderr.write(`[github_issues MCP] Loaded GH_TOKEN from git credentials\n`);
        }
      } catch (err) {
        process.stderr.write(`[github_issues MCP] Failed to load git credentials: ${err}\n`);
      }
    }

    // Ensure gh is on PATH — add common locations
    const extraPaths = [
      '/nix/store',
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
    ];
    process.env.PATH = [process.env.PATH, ...extraPaths].filter(Boolean).join(':');

    process.stderr.write(`[github_issues MCP] Using gh binary: ${GH_BIN}\n`);
    const args = ['issue', 'create', '--title', title, '--body', fullBody];
    for (const label of labels) {
      args.push('--label', label);
    }
    const result = await runCommand(GH_BIN, args);
    process.stderr.write(`[github_issues MCP] gh result: exit=${result.exitCode} stdout=${result.stdout.slice(0, 200)} stderr=${result.stderr.slice(0, 200)}\n`);
    if (result.exitCode !== 0) {
      return { content: [{ type: 'text' as const, text: `Failed to create issue:\n${result.stderr}` }] };
    }
    return { content: [{ type: 'text' as const, text: result.stdout.trim() }] };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('GitHub Issues MCP server failed:', err);
  process.exit(1);
});
