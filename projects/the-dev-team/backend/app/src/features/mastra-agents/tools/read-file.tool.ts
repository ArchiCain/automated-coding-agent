/**
 * Pi-derived read-file tool with offset/limit pagination,
 * dual truncation, line numbers, and continuation hints.
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { truncateHead, formatSize } from './lib/truncate';

const DEFAULT_LIMIT = 2000;
const DEFAULT_MAX_BYTES = 50 * 1024;

export async function createReadFileTool(rootPath: string) {
  const { createTool } = await import('@mastra/core/tools');
  const { z } = await import('zod');

  return createTool({
    id: 'read-file',
    description:
      'Read file contents with optional pagination. Returns line-numbered output. ' +
      'For large files, use offset and limit to read specific sections. ' +
      'Path is relative to the working directory.',
    inputSchema: z.object({
      path: z.string().describe('File path relative to working directory'),
      offset: z
        .number()
        .optional()
        .describe('Line number to start reading from (1-indexed, default: 1)'),
      limit: z
        .number()
        .optional()
        .describe(`Maximum number of lines to read (default: ${DEFAULT_LIMIT})`),
    }),
    outputSchema: z.object({
      path: z.string(),
      content: z.string(),
      totalLines: z.number(),
      totalBytes: z.number(),
      truncated: z.boolean(),
    }),
    execute: async (input) => {
      const resolved = path.resolve(rootPath, input.path);
      if (!resolved.startsWith(rootPath)) {
        return {
          path: input.path,
          content: '[Error] Path outside working directory.',
          totalLines: 0,
          totalBytes: 0,
          truncated: false,
        };
      }

      let raw: string;
      try {
        raw = await fs.readFile(resolved, 'utf-8');
      } catch {
        return {
          path: input.path,
          content: `[Error] File not found: ${input.path}`,
          totalLines: 0,
          totalBytes: 0,
          truncated: false,
        };
      }

      const allLines = raw.split('\n');
      const totalLines = allLines.length;
      const totalBytes = Buffer.byteLength(raw, 'utf-8');

      // Apply offset (1-indexed)
      const offset = Math.max(1, input.offset ?? 1);
      const startIndex = offset - 1;

      if (startIndex >= totalLines) {
        return {
          path: input.path,
          content: `[Error] Offset ${offset} is beyond end of file (${totalLines} lines).`,
          totalLines,
          totalBytes,
          truncated: false,
        };
      }

      // Slice from offset
      const userLimit = input.limit ?? DEFAULT_LIMIT;
      const sliced = allLines.slice(startIndex, startIndex + userLimit);
      const slicedText = sliced.join('\n');

      // Apply truncation (byte limit)
      const result = truncateHead(slicedText, sliced.length, DEFAULT_MAX_BYTES);

      // Add line numbers
      const outputLines = result.content.split('\n');
      const maxLineNum = startIndex + outputLines.length;
      const padWidth = String(maxLineNum).length;
      const numbered = outputLines
        .map((line, i) => `${String(startIndex + i + 1).padStart(padWidth)} | ${line}`)
        .join('\n');

      // Build continuation hints
      const linesShown = outputLines.length;
      const linesRemaining = totalLines - (startIndex + linesShown);
      let content = numbered;

      if (result.truncated || linesRemaining > 0) {
        const nextOffset = startIndex + linesShown + 1;
        const notices: string[] = [];
        if (result.truncated) {
          notices.push(
            `[Truncated by ${result.truncatedBy}: showing ${formatSize(result.outputBytes)} of ${formatSize(totalBytes)}]`,
          );
        }
        if (linesRemaining > 0) {
          notices.push(
            `[${linesRemaining} more lines. Use offset=${nextOffset} to continue.]`,
          );
        }
        content += '\n' + notices.join('\n');
      }

      return {
        path: input.path,
        content,
        totalLines,
        totalBytes,
        truncated: result.truncated || linesRemaining > 0,
      };
    },
  });
}
