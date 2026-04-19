/**
 * Git tool wrappers for Mastra agents.
 * Each git operation is a separate tool. Returns a record of tools.
 */

import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import { truncateHead } from './lib/truncate';

const execFile = promisify(execFileCb);

async function runGit(
  args: string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await execFile('git', args, {
      cwd,
      timeout: 60_000,
      maxBuffer: 5 * 1024 * 1024,
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || String(err),
      exitCode: error.code || 1,
    };
  }
}

export async function createGitTools(rootPath: string) {
  const { createTool } = await import('@mastra/core/tools');
  const { z } = await import('zod');

  const gitStatus = createTool({
    id: 'git-status',
    description: 'Show current branch and working tree status (short format).',
    inputSchema: z.object({}),
    outputSchema: z.object({ output: z.string(), error: z.string().optional() }),
    execute: async () => {
      const branch = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], rootPath);
      const status = await runGit(['status', '--short'], rootPath);
      if (status.exitCode !== 0) {
        return { output: '', error: status.stderr };
      }
      return {
        output: `Branch: ${branch.stdout.trim()}\n${status.stdout || '(clean)'}`,
      };
    },
  });

  const gitDiff = createTool({
    id: 'git-diff',
    description:
      'Show diff of working tree changes. Use cached=true for staged changes. ' +
      'Optionally specify a path to diff specific files.',
    inputSchema: z.object({
      cached: z.boolean().optional().describe('Show staged changes (default: unstaged)'),
      path: z.string().optional().describe('File or directory to diff'),
    }),
    outputSchema: z.object({ output: z.string(), error: z.string().optional() }),
    execute: async (input) => {
      const args = ['diff'];
      if (input.cached) args.push('--cached');
      if (input.path) args.push('--', input.path);

      const result = await runGit(args, rootPath);
      if (result.exitCode !== 0) {
        return { output: '', error: result.stderr };
      }

      const truncated = truncateHead(result.stdout, 2000, 50 * 1024);
      let output = truncated.content || '(no changes)';
      if (truncated.truncated) {
        output += `\n[Diff truncated: showing ${truncated.outputLines} of ${truncated.totalLines} lines]`;
      }
      return { output };
    },
  });

  const gitLog = createTool({
    id: 'git-log',
    description: 'Show recent commit history (oneline format).',
    inputSchema: z.object({
      count: z.number().optional().describe('Number of commits to show (default: 10)'),
      path: z.string().optional().describe('Show commits for a specific file/directory'),
    }),
    outputSchema: z.object({ output: z.string(), error: z.string().optional() }),
    execute: async (input) => {
      const args = ['log', `--oneline`, `-${input.count || 10}`];
      if (input.path) args.push('--', input.path);

      const result = await runGit(args, rootPath);
      if (result.exitCode !== 0) {
        return { output: '', error: result.stderr };
      }
      return { output: result.stdout || '(no commits)' };
    },
  });

  const gitAdd = createTool({
    id: 'git-add',
    description: 'Stage files for commit. Use paths="." to stage all changes.',
    inputSchema: z.object({
      paths: z.string().describe('Space-separated file paths to stage, or "." for all'),
    }),
    outputSchema: z.object({ output: z.string(), error: z.string().optional() }),
    execute: async (input) => {
      const pathList = input.paths.split(/\s+/).filter(Boolean);
      const result = await runGit(['add', ...pathList], rootPath);
      if (result.exitCode !== 0) {
        return { output: '', error: result.stderr };
      }
      return { output: `Staged: ${pathList.join(', ')}` };
    },
  });

  const gitCommit = createTool({
    id: 'git-commit',
    description: 'Commit staged changes with a message.',
    inputSchema: z.object({
      message: z.string().describe('Commit message'),
    }),
    outputSchema: z.object({ output: z.string(), error: z.string().optional() }),
    execute: async (input) => {
      const result = await runGit(['commit', '-m', input.message], rootPath);
      if (result.exitCode !== 0) {
        return { output: '', error: result.stderr };
      }
      return { output: result.stdout.trim() };
    },
  });

  const gitBranch = createTool({
    id: 'git-branch',
    description: 'List all branches (local and remote).',
    inputSchema: z.object({}),
    outputSchema: z.object({ output: z.string(), error: z.string().optional() }),
    execute: async () => {
      const result = await runGit(['branch', '-a'], rootPath);
      if (result.exitCode !== 0) {
        return { output: '', error: result.stderr };
      }
      return { output: result.stdout };
    },
  });

  return {
    gitStatus,
    gitDiff,
    gitLog,
    gitAdd,
    gitCommit,
    gitBranch,
  };
}
