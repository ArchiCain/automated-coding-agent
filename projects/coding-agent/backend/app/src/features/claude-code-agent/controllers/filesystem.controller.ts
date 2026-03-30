import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface FileEntry {
  name: string;
  type: 'file' | 'directory';
  path: string;
}

@Controller('api/filesystem')
export class FilesystemController {
  private readonly repoRoot: string;

  constructor() {
    this.repoRoot = process.env.REPO_ROOT || path.resolve(__dirname, '../../../../../../../');
  }

  /**
   * Browse directory contents, restricted to repo root subtree
   */
  @Get('browse')
  async browse(@Query('path') dirPath?: string): Promise<{ entries: FileEntry[]; currentPath: string }> {
    const targetPath = dirPath
      ? path.resolve(this.repoRoot, dirPath)
      : this.repoRoot;

    // Security: ensure path stays within repo root
    if (!targetPath.startsWith(this.repoRoot)) {
      throw new BadRequestException('Path traversal detected: path must be within the repository');
    }

    try {
      const entries = await fs.readdir(targetPath, { withFileTypes: true });
      const results: FileEntry[] = [];

      for (const entry of entries) {
        // Skip hidden dirs (except .agent-prompts), node_modules, dist, etc.
        if (entry.name.startsWith('.') && entry.name !== '.agent-prompts') continue;
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;

        const relativePath = path.relative(this.repoRoot, path.join(targetPath, entry.name));
        results.push({
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
          path: relativePath,
        });
      }

      // Sort: directories first, then alphabetically
      results.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      const currentRelative = path.relative(this.repoRoot, targetPath);
      return { entries: results, currentPath: currentRelative || '.' };
    } catch {
      throw new BadRequestException(`Cannot read directory: ${dirPath || '.'}`);
    }
  }
}
