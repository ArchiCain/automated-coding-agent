import * as path from 'path';
import * as fs from 'fs/promises';

const REPO_ROOT = process.env.REPO_ROOT || '/workspace';
const PROJECTS_ROOT = 'projects/application';

const EXCLUDED = new Set([
  'node_modules', 'dist', '.git', '.angular', '.vite',
  'chart', 'dockerfiles', 'coverage', '__pycache__',
  '.next', '.nuxt', 'build', '.turbo',
]);

export async function createListDirTool() {
  const { createTool } = await import('@mastra/core/tools');
  const { z } = await import('zod');

  return createTool({
    id: 'list-dir',
    description:
      'List files and directories at a given path within the projects. ' +
      'The path is relative to projects/application/ (e.g. "frontend", "frontend/app/src/app/features/keycloak-auth", "backend/app/src/features"). ' +
      'Returns directory entries with type (file/dir) and whether they are documentation (.docs).',
    inputSchema: z.object({
      path: z
        .string()
        .describe('Path relative to projects/application/, e.g. "frontend/app/src/app/features/keycloak-auth"')
        .default(''),
    }),
    outputSchema: z.object({
      path: z.string(),
      entries: z.array(z.object({
        name: z.string(),
        type: z.enum(['file', 'dir']),
        isDoc: z.boolean(),
      })),
      error: z.string().optional(),
    }),
    execute: async (input) => {
      const root = path.resolve(REPO_ROOT, PROJECTS_ROOT);
      const resolved = path.resolve(root, input.path);

      if (!resolved.startsWith(root)) {
        return { path: input.path, entries: [], error: 'Path outside projects directory.' };
      }

      try {
        const entries = await fs.readdir(resolved, { withFileTypes: true });
        const result = entries
          .filter((e) => {
            if (e.isDirectory() && EXCLUDED.has(e.name)) return false;
            if (e.name.startsWith('.') && e.name !== '.docs') return false;
            return true;
          })
          .map((e) => ({
            name: e.name,
            type: (e.isDirectory() ? 'dir' : 'file') as 'file' | 'dir',
            isDoc: e.name === '.docs' || input.path.includes('.docs'),
          }))
          .sort((a, b) => {
            if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
            return a.name.localeCompare(b.name);
          });

        return { path: input.path, entries: result };
      } catch {
        return { path: input.path, entries: [], error: `Directory not found: ${input.path}` };
      }
    },
  });
}
