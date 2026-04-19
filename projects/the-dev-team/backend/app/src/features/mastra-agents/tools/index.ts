/**
 * Tool barrel — exports factory functions that create scoped tool sets
 * for different agent types. Each factory takes a rootPath parameter
 * that scopes all file operations.
 */

import { createReadFileTool } from './read-file.tool';
import { createEditFileTool } from './edit-file.tool';
import { createWriteFileTool } from './write-file.tool';
import { createListDirTool } from './list-dir.tool';
import { createSearchContentTool } from './search-content.tool';
import { createSearchFilesTool } from './search-files.tool';
import { createRunTaskTool } from './run-task.tool';
import { createGitTools } from './git.tool';

/**
 * Tools for the docs assistant agent.
 * File operations scoped to rootPath. No git write ops, no task execution.
 */
export async function createDocsTools(rootPath: string) {
  const [readFile, editFile, writeFile, listDir, searchContent, searchFiles] =
    await Promise.all([
      createReadFileTool(rootPath),
      createEditFileTool(rootPath),
      createWriteFileTool(rootPath),
      createListDirTool(rootPath),
      createSearchContentTool(rootPath),
      createSearchFilesTool(rootPath),
    ]);

  return { readFile, editFile, writeFile, listDir, searchContent, searchFiles };
}

/**
 * Tools for the sync agent.
 * All docs tools + git operations + task execution.
 * rootPath should be the worktree path for isolated development.
 */
export async function createSyncTools(rootPath: string) {
  const [docsTools, gitTools, runTask] = await Promise.all([
    createDocsTools(rootPath),
    createGitTools(rootPath),
    createRunTaskTool(rootPath),
  ]);

  return {
    ...docsTools,
    ...gitTools,
    runTask,
  };
}
