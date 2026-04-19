/**
 * Pi-derived write-file tool with auto-mkdir and file mutation queue.
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { withFileMutationQueue } from './lib/file-mutation-queue';

export async function createWriteFileTool(rootPath: string) {
  const { createTool } = await import('@mastra/core/tools');
  const { z } = await import('zod');

  return createTool({
    id: 'write-file',
    description:
      'Write or create a file. Creates parent directories if needed. ' +
      'This overwrites the entire file — use edit-file for targeted modifications to existing files. ' +
      'Path is relative to the working directory.',
    inputSchema: z.object({
      path: z.string().describe('File path relative to working directory'),
      content: z.string().describe('Full content to write to the file'),
    }),
    outputSchema: z.object({
      path: z.string(),
      success: z.boolean(),
      bytesWritten: z.number().optional(),
      error: z.string().optional(),
    }),
    execute: async (input) => {
      const resolved = path.resolve(rootPath, input.path);
      if (!resolved.startsWith(rootPath)) {
        return { path: input.path, success: false, error: 'Path outside working directory.' };
      }

      try {
        return await withFileMutationQueue(resolved, async () => {
          await fs.mkdir(path.dirname(resolved), { recursive: true });
          await fs.writeFile(resolved, input.content, 'utf-8');
          const bytesWritten = Buffer.byteLength(input.content, 'utf-8');
          return { path: input.path, success: true, bytesWritten };
        });
      } catch (err) {
        return {
          path: input.path,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  });
}
