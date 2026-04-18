import * as path from 'path';
import * as fs from 'fs/promises';

const REPO_ROOT = process.env.REPO_ROOT || '/workspace';
const PROJECTS_ROOT = 'projects/application';

export async function createWriteFileTool() {
  const { createTool } = await import('@mastra/core/tools');
  const { z } = await import('zod');

  return createTool({
    id: 'write-file',
    description:
      'Write or update a file within the projects. Creates parent directories if needed. ' +
      'Use this to update documentation files (.docs/*.md). ' +
      'The path is relative to projects/application/. Provide the full file content — this overwrites the entire file.',
    inputSchema: z.object({
      path: z
        .string()
        .describe('File path relative to projects/application/'),
      content: z
        .string()
        .describe('The full content to write to the file'),
    }),
    outputSchema: z.object({
      path: z.string(),
      success: z.boolean(),
      error: z.string().optional(),
    }),
    execute: async (input) => {
      const root = path.resolve(REPO_ROOT, PROJECTS_ROOT);
      const resolved = path.resolve(root, input.path);

      if (!resolved.startsWith(root)) {
        return { path: input.path, success: false, error: 'Path outside projects directory.' };
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
