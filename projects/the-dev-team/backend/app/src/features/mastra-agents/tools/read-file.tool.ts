import * as path from 'path';
import * as fs from 'fs/promises';

const REPO_ROOT = process.env.REPO_ROOT || '/workspace';
const PROJECTS_ROOT = 'projects/application';

export async function createReadFileTool() {
  const { createTool } = await import('@mastra/core/tools');
  const { z } = await import('zod');

  return createTool({
    id: 'read-file',
    description:
      'Read the full contents of any file within the projects. Works for both documentation (.docs/) and source code files. ' +
      'The path is relative to projects/application/ (e.g. "frontend/.docs/overview.md", "frontend/app/src/app/features/keycloak-auth/services/auth.service.ts", "backend/app/src/features/health/controllers/health.controller.ts").',
    inputSchema: z.object({
      path: z
        .string()
        .describe('File path relative to projects/application/'),
    }),
    outputSchema: z.object({
      path: z.string(),
      content: z.string(),
    }),
    execute: async (input) => {
      const root = path.resolve(REPO_ROOT, PROJECTS_ROOT);
      const resolved = path.resolve(root, input.path);

      if (!resolved.startsWith(root)) {
        return { path: input.path, content: '[Error] Path outside projects directory.' };
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
