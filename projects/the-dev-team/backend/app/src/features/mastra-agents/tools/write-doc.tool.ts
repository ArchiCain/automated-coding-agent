import * as path from 'path';
import * as fs from 'fs/promises';

const REPO_ROOT = process.env.REPO_ROOT || '/workspace';
const DOCS_ROOT = 'projects/application/frontend/docs';

/**
 * Creates the write-doc Mastra tool using dynamic import (ESM-only @mastra/core).
 */
export async function createWriteDocTool() {
  const { createTool } = await import('@mastra/core/tools');
  const { z } = await import('zod');

  return createTool({
    id: 'write-doc',
    description:
      'Write or update a project documentation file. Creates parent directories if needed. ' +
      'The path is relative to the docs root (e.g. "features/auth/requirements.md", "standards/coding.md"). ' +
      'Provide the full file content — this overwrites the entire file.',
    inputSchema: z.object({
      path: z
        .string()
        .describe('File path relative to the docs root, e.g. "features/auth/requirements.md"'),
      content: z
        .string()
        .describe('The full markdown content to write to the file'),
    }),
    outputSchema: z.object({
      path: z.string(),
      success: z.boolean(),
      error: z.string().optional(),
    }),
    execute: async (input) => {
      const docsRoot = path.resolve(REPO_ROOT, DOCS_ROOT);
      const resolved = path.resolve(docsRoot, input.path);

      if (!resolved.startsWith(docsRoot)) {
        return { path: input.path, success: false, error: 'Path outside docs directory.' };
      }

      try {
        await fs.mkdir(path.dirname(resolved), { recursive: true });
        await fs.writeFile(resolved, input.content, 'utf-8');
        return { path: input.path, success: true };
      } catch (err) {
        return { path: input.path, success: false, error: String(err) };
      }
    },
  });
}
