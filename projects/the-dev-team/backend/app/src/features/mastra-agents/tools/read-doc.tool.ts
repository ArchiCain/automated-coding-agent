import * as path from 'path';
import * as fs from 'fs/promises';

const REPO_ROOT = process.env.REPO_ROOT || '/workspace';
const DOCS_ROOT = 'projects/application/frontend/docs';

/**
 * Creates the read-doc Mastra tool using dynamic import (ESM-only @mastra/core).
 */
export async function createReadDocTool() {
  const { createTool } = await import('@mastra/core/tools');
  const { z } = await import('zod');

  return createTool({
    id: 'read-doc',
    description:
      'Read the full contents of a project documentation file. ' +
      'The path is relative to the docs root (e.g. "features/auth/requirements.md", "standards/coding.md", "overview.md").',
    inputSchema: z.object({
      path: z
        .string()
        .describe('File path relative to the docs root, e.g. "features/auth/requirements.md"'),
    }),
    outputSchema: z.object({
      path: z.string(),
      content: z.string(),
    }),
    execute: async (input) => {
      const docsRoot = path.resolve(REPO_ROOT, DOCS_ROOT);
      const resolved = path.resolve(docsRoot, input.path);

      // Prevent path traversal
      if (!resolved.startsWith(docsRoot)) {
        return { path: input.path, content: '[Error] Path outside docs directory.' };
      }

      try {
        const content = await fs.readFile(resolved, 'utf-8');
        return { path: input.path, content };
      } catch {
        return { path: input.path, content: `[Error] File not found: ${input.path}` };
      }
    },
  });
}
