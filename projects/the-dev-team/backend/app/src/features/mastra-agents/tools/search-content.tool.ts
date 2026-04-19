/**
 * Pi-derived search-content tool (grep replacement).
 * Spawns ripgrep in JSON mode with per-line truncation and match cap.
 */

import * as path from 'path';
import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { truncateLine, truncateHead, formatSize } from './lib/truncate';

const DEFAULT_LIMIT = 100;
const RG_BINARY = '/opt/homebrew/bin/rg';

export async function createSearchContentTool(rootPath: string) {
  const { createTool } = await import('@mastra/core/tools');
  const { z } = await import('zod');

  return createTool({
    id: 'search-content',
    description:
      'Search file contents using regex or literal patterns (like grep). ' +
      'Returns matching lines with file paths and line numbers. ' +
      'Use glob to filter which files to search. ' +
      'Path is relative to the working directory.',
    inputSchema: z.object({
      pattern: z.string().describe('Search pattern (regex or literal string)'),
      path: z
        .string()
        .optional()
        .describe('Directory or file to search (default: working directory)'),
      glob: z
        .string()
        .optional()
        .describe("Filter files by glob pattern, e.g. '*.ts' or '**/*.spec.ts'"),
      ignoreCase: z
        .boolean()
        .optional()
        .describe('Case-insensitive search (default: false)'),
      literal: z
        .boolean()
        .optional()
        .describe('Treat pattern as literal string instead of regex (default: false)'),
      context: z
        .number()
        .optional()
        .describe('Lines of context before and after each match (default: 0)'),
      limit: z
        .number()
        .optional()
        .describe(`Maximum matches to return (default: ${DEFAULT_LIMIT})`),
    }),
    outputSchema: z.object({
      matches: z.array(z.string()),
      totalMatches: z.number(),
      truncated: z.boolean(),
      error: z.string().optional(),
    }),
    execute: async (input) => {
      const searchPath = input.path
        ? path.resolve(rootPath, input.path)
        : rootPath;

      if (!searchPath.startsWith(rootPath)) {
        return { matches: [], totalMatches: 0, truncated: false, error: 'Path outside working directory.' };
      }

      const effectiveLimit = input.limit ?? DEFAULT_LIMIT;

      const args = ['--json', '--line-number', '--no-heading'];
      if (input.literal) args.push('--fixed-strings');
      if (input.ignoreCase) args.push('-i');
      if (input.glob) args.push(`--glob=${input.glob}`);
      if (input.context) args.push(`-C`, String(input.context));
      args.push('--', input.pattern, searchPath);

      return new Promise((resolve) => {
        const child = spawn(RG_BINARY, args, {
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 30_000,
        });

        const matches: string[] = [];
        let matchCount = 0;
        let linesTruncated = false;
        let stderr = '';

        const rl = createInterface({ input: child.stdout });

        rl.on('line', (line) => {
          try {
            const event = JSON.parse(line);
            if (event.type === 'match') {
              if (matchCount >= effectiveLimit) {
                child.kill('SIGTERM');
                return;
              }

              const data = event.data;
              const filePath = path.relative(rootPath, data.path.text);
              const lineNum = data.line_number;
              const lineText = data.lines?.text?.replace(/\n$/, '') ?? '';

              const { text: truncatedLine, wasTruncated } = truncateLine(lineText);
              if (wasTruncated) linesTruncated = true;

              matches.push(`${filePath}:${lineNum}: ${truncatedLine}`);
              matchCount++;
            }
          } catch {
            // Skip non-JSON lines
          }
        });

        child.stderr.on('data', (chunk) => {
          stderr += chunk.toString();
        });

        child.on('close', () => {
          // Apply byte truncation to final output
          const combined = matches.join('\n');
          const result = truncateHead(combined, matches.length, 50 * 1024);

          const finalMatches = result.truncated
            ? result.content.split('\n')
            : matches;

          const notices: string[] = [];
          if (matchCount >= effectiveLimit) {
            notices.push(`[Stopped at ${effectiveLimit} matches. Use limit= to increase.]`);
          }
          if (linesTruncated) {
            notices.push('[Some lines were truncated to 500 chars.]');
          }
          if (result.truncated) {
            notices.push(`[Output truncated to ${formatSize(result.outputBytes)}.]`);
          }

          if (notices.length > 0) {
            finalMatches.push('', ...notices);
          }

          resolve({
            matches: finalMatches,
            totalMatches: matchCount,
            truncated: matchCount >= effectiveLimit || result.truncated,
          });
        });

        child.on('error', (err) => {
          resolve({
            matches: [],
            totalMatches: 0,
            truncated: false,
            error: `Search failed: ${err.message}`,
          });
        });
      });
    },
  });
}
