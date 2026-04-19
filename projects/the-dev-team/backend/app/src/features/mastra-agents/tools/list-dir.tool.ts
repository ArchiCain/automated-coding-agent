/**
 * Pi-derived list-dir tool with dir/ suffix notation,
 * entry limits, and context-efficient string[] output.
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { truncateHead } from './lib/truncate';

const DEFAULT_LIMIT = 500;
const MAX_OUTPUT_BYTES = 4 * 1024; // 4KB

const EXCLUDED = new Set([
  'node_modules', 'dist', '.git', '.angular', '.vite',
  'chart', 'dockerfiles', 'coverage', '__pycache__',
  '.next', '.nuxt', 'build', '.turbo',
]);

export async function createListDirTool(rootPath: string) {
  const { createTool } = await import('@mastra/core/tools');
  const { z } = await import('zod');

  return createTool({
    id: 'list-dir',
    description:
      'List files and directories at a path. Directories are shown with a trailing /. ' +
      'Sorted: directories first (case-insensitive), then files. ' +
      'Path is relative to the working directory.',
    inputSchema: z.object({
      path: z
        .string()
        .describe('Directory path relative to working directory')
        .default(''),
      limit: z
        .number()
        .optional()
        .describe(`Maximum entries to return (default: ${DEFAULT_LIMIT})`),
    }),
    outputSchema: z.object({
      path: z.string(),
      entries: z.array(z.string()),
      totalEntries: z.number(),
      truncated: z.boolean(),
      error: z.string().optional(),
    }),
    execute: async (input) => {
      const resolved = path.resolve(rootPath, input.path);
      if (!resolved.startsWith(rootPath)) {
        return { path: input.path, entries: [], totalEntries: 0, truncated: false, error: 'Path outside working directory.' };
      }

      try {
        const dirents = await fs.readdir(resolved, { withFileTypes: true });

        // Filter excluded directories and hidden files (except .docs)
        const filtered = dirents.filter((e) => {
          if (e.isDirectory() && EXCLUDED.has(e.name)) return false;
          if (e.name.startsWith('.') && e.name !== '.docs') return false;
          return true;
        });

        // Sort: directories first, case-insensitive
        filtered.sort((a, b) => {
          const aDir = a.isDirectory();
          const bDir = b.isDirectory();
          if (aDir !== bDir) return aDir ? -1 : 1;
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        });

        const totalEntries = filtered.length;
        const limit = input.limit ?? DEFAULT_LIMIT;

        // Build string entries with dir/ suffix
        const entries: string[] = [];
        for (let i = 0; i < Math.min(filtered.length, limit); i++) {
          const e = filtered[i];
          entries.push(e.isDirectory() ? `${e.name}/` : e.name);
        }

        // Apply byte limit
        const text = entries.join('\n');
        const result = truncateHead(text, entries.length, MAX_OUTPUT_BYTES);
        const finalEntries = result.truncated
          ? result.content.split('\n')
          : entries;

        return {
          path: input.path || '.',
          entries: finalEntries,
          totalEntries,
          truncated: finalEntries.length < totalEntries,
        };
      } catch {
        return {
          path: input.path || '.',
          entries: [],
          totalEntries: 0,
          truncated: false,
          error: `Directory not found: ${input.path || '.'}`,
        };
      }
    },
  });
}
