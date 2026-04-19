/**
 * Scoped Taskfile execution tool.
 * Validates against a whitelist and truncates output.
 */

import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import { truncateTail } from './lib/truncate';

const execFile = promisify(execFileCb);

const ALLOWED_TASKS = [
  'env:deploy',
  'env:destroy',
  'env:health',
  'env:list',
  'env:status',
  'env:restart',
  'env:logs',
  'build:all',
  'build:backend',
  'build:frontend',
  'run-all-tests',
  'backend:local:test',
  'frontend:local:test',
];

export async function createRunTaskTool(rootPath: string) {
  const { createTool } = await import('@mastra/core/tools');
  const { z } = await import('zod');

  return createTool({
    id: 'run-task',
    description:
      'Run a Taskfile task. Only whitelisted tasks are allowed. ' +
      `Available tasks: ${ALLOWED_TASKS.join(', ')}`,
    inputSchema: z.object({
      taskName: z.string().describe('Task name to run'),
      vars: z
        .record(z.string(), z.string())
        .optional()
        .describe('Variables to pass to the task (e.g. { NAME: "my-env" })'),
    }),
    outputSchema: z.object({
      taskName: z.string(),
      success: z.boolean(),
      output: z.string(),
      exitCode: z.number(),
      error: z.string().optional(),
    }),
    execute: async (input) => {
      if (!ALLOWED_TASKS.includes(input.taskName)) {
        return {
          taskName: input.taskName,
          success: false,
          output: '',
          exitCode: 1,
          error: `Task "${input.taskName}" is not allowed. Available: ${ALLOWED_TASKS.join(', ')}`,
        };
      }

      const args = [input.taskName];
      if (input.vars) {
        for (const [key, value] of Object.entries(input.vars)) {
          args.push(`${key}=${value}`);
        }
      }

      try {
        const { stdout, stderr } = await execFile('task', args, {
          cwd: rootPath,
          timeout: 600_000, // 10 minutes
          maxBuffer: 10 * 1024 * 1024,
        });

        const combined = stdout + (stderr ? `\n[stderr]\n${stderr}` : '');
        const result = truncateTail(combined, 200, 20 * 1024);

        let output = result.content;
        if (result.truncated) {
          output = `[Output truncated — showing last ${result.outputLines} of ${result.totalLines} lines]\n` + output;
        }

        return {
          taskName: input.taskName,
          success: true,
          output,
          exitCode: 0,
        };
      } catch (err: unknown) {
        const error = err as { stdout?: string; stderr?: string; code?: number };
        const combined = (error.stdout || '') + (error.stderr ? `\n[stderr]\n${error.stderr}` : '');
        const result = truncateTail(combined, 200, 20 * 1024);

        return {
          taskName: input.taskName,
          success: false,
          output: result.content,
          exitCode: error.code || 1,
          error: `Task failed with exit code ${error.code || 1}`,
        };
      }
    },
  });
}
