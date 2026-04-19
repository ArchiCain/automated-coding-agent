/**
 * Pi-derived edit-file tool with multi-edit support,
 * fuzzy matching, BOM/CRLF handling, overlap detection, and diff output.
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { withFileMutationQueue } from './lib/file-mutation-queue';
import {
  detectLineEnding,
  normalizeToLF,
  restoreLineEndings,
  stripBom,
  restoreBom,
  applyEditsToNormalizedContent,
  generateDiffString,
} from './lib/edit-helpers';

export async function createEditFileTool(rootPath: string) {
  const { createTool } = await import('@mastra/core/tools');
  const { z } = await import('zod');

  return createTool({
    id: 'edit-file',
    description:
      'Make targeted edits to a file. Each edit replaces an exact oldText snippet with newText. ' +
      'Supports fuzzy matching for whitespace/unicode differences. ' +
      'Use this instead of write-file when modifying existing files — it verifies the text you expect is actually there. ' +
      'Multiple edits are applied atomically. Path is relative to the working directory.',
    inputSchema: z.object({
      path: z.string().describe('File path relative to working directory'),
      edits: z
        .array(
          z.object({
            oldText: z.string().describe('Exact text to find (must be unique in the file)'),
            newText: z.string().describe('Replacement text'),
          }),
        )
        .describe('Array of edits to apply. Each oldText must be unique in the file.'),
    }),
    outputSchema: z.object({
      path: z.string(),
      success: z.boolean(),
      diff: z.string().optional(),
      error: z.string().optional(),
    }),
    execute: async (input) => {
      const resolved = path.resolve(rootPath, input.path);
      if (!resolved.startsWith(rootPath)) {
        return { path: input.path, success: false, error: 'Path outside working directory.' };
      }

      try {
        return await withFileMutationQueue(resolved, async () => {
          // Read file
          let raw: string;
          try {
            raw = await fs.readFile(resolved, 'utf-8');
          } catch {
            return {
              path: input.path,
              success: false,
              error: `File not found: ${input.path}`,
            };
          }

          // Strip BOM, detect and normalize line endings
          const { content: noBom, hasBom } = stripBom(raw);
          const originalEnding = detectLineEnding(noBom);
          const normalized = normalizeToLF(noBom);

          // Apply edits
          let result;
          try {
            result = applyEditsToNormalizedContent(normalized, input.edits);
          } catch (err) {
            return {
              path: input.path,
              success: false,
              error: err instanceof Error ? err.message : String(err),
            };
          }

          // Restore BOM and line endings
          const restored = restoreBom(
            restoreLineEndings(result.newContent, originalEnding),
            hasBom,
          );

          // Write file
          await fs.writeFile(resolved, restored, 'utf-8');

          // Generate diff
          const { diff } = generateDiffString(result.baseContent, result.newContent);

          return {
            path: input.path,
            success: true,
            diff: diff || '(no visible changes in diff)',
          };
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
