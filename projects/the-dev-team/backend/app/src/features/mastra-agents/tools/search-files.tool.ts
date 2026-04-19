/**
 * Pi-derived search-files tool (find replacement).
 * Spawns fd for glob-based file search with result limits.
 */

import * as path from 'path';
import { spawn } from 'child_process';
import { createInterface } from 'readline';

const DEFAULT_LIMIT = 1000;
const FD_BINARY = '/opt/homebrew/bin/fd';

export async function createSearchFilesTool(rootPath: string) {
  const { createTool } = await import('@mastra/core/tools');
  const { z } = await import('zod');

  return createTool({
    id: 'search-files',
    description:
      'Find files by name pattern using glob matching. ' +
      'Respects .gitignore. Returns relative paths. ' +
      'Path is relative to the working directory.',
    inputSchema: z.object({
      pattern: z
        .string()
        .describe("Glob pattern to match files, e.g. '*.ts', '**/*.json', or 'src/**/*.spec.ts'"),
      path: z
        .string()
        .optional()
        .describe('Directory to search in (default: working directory)'),
      limit: z
        .number()
        .optional()
        .describe(`Maximum results (default: ${DEFAULT_LIMIT})`),
    }),
    outputSchema: z.object({
      files: z.array(z.string()),
      totalFiles: z.number(),
      truncated: z.boolean(),
      error: z.string().optional(),
    }),
    execute: async (input) => {
      const searchPath = input.path
        ? path.resolve(rootPath, input.path)
        : rootPath;

      if (!searchPath.startsWith(rootPath)) {
        return { files: [], totalFiles: 0, truncated: false, error: 'Path outside working directory.' };
      }

      const effectiveLimit = input.limit ?? DEFAULT_LIMIT;

      const args = ['--glob', '--hidden', '--no-require-git'];

      // If pattern contains /, use full-path matching and prepend **/ if needed
      let pattern = input.pattern;
      if (pattern.includes('/')) {
        args.push('--full-path');
        if (!pattern.startsWith('**/') && !pattern.startsWith('/')) {
          pattern = `**/${pattern}`;
        }
      }

      args.push(pattern, searchPath);

      return new Promise((resolve) => {
        const child = spawn(FD_BINARY, args, {
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 30_000,
        });

        const files: string[] = [];
        let totalFiles = 0;

        const rl = createInterface({ input: child.stdout });

        rl.on('line', (line) => {
          totalFiles++;
          if (files.length < effectiveLimit) {
            const relativePath = path.relative(rootPath, line.trim());
            files.push(relativePath);
          } else {
            child.kill('SIGTERM');
          }
        });

        let stderr = '';
        child.stderr.on('data', (chunk) => {
          stderr += chunk.toString();
        });

        child.on('close', () => {
          const truncated = totalFiles > effectiveLimit;
          if (truncated) {
            files.push(
              `[Showing ${effectiveLimit} of ${totalFiles}+ results. Use limit= to increase.]`,
            );
          }

          resolve({
            files,
            totalFiles,
            truncated,
          });
        });

        child.on('error', (err) => {
          resolve({
            files: [],
            totalFiles: 0,
            truncated: false,
            error: `File search failed: ${err.message}`,
          });
        });
      });
    },
  });
}
