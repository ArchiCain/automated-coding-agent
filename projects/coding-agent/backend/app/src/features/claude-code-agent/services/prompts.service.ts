import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface PromptInfo {
  filename: string;
  name: string;
  description: string;
}

@Injectable()
export class PromptsService {
  private readonly logger = new Logger(PromptsService.name);
  private readonly promptsDir: string;

  constructor() {
    const repoRoot = process.env.REPO_ROOT || path.resolve(__dirname, '../../../../../../../');
    this.promptsDir = path.join(repoRoot, '.agent-prompts');
  }

  /**
   * List all prompt files in .agent-prompts/
   */
  async listPrompts(): Promise<PromptInfo[]> {
    try {
      await fs.mkdir(this.promptsDir, { recursive: true });
      const entries = await fs.readdir(this.promptsDir, { withFileTypes: true });
      const prompts: PromptInfo[] = [];

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          const filePath = path.join(this.promptsDir, entry.name);
          const content = await fs.readFile(filePath, 'utf-8');
          const firstLine = content.split('\n').find((l) => l.trim().length > 0) || '';
          // Strip markdown heading prefix
          const description = firstLine.replace(/^#+\s*/, '').trim();

          prompts.push({
            filename: entry.name,
            name: entry.name.replace('.md', ''),
            description,
          });
        }
      }

      return prompts.sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
      this.logger.error(`Failed to list prompts: ${err}`);
      return [];
    }
  }

  /**
   * Read a specific prompt file
   */
  async readPrompt(filename: string): Promise<string> {
    this.validateFilename(filename);
    const filePath = this.resolvePromptPath(filename);

    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (err) {
      throw new NotFoundException(`Prompt file not found: ${filename}`);
    }
  }

  /**
   * Create a new prompt file
   */
  async createPrompt(filename: string, content: string): Promise<void> {
    this.validateFilename(filename);
    const filePath = this.resolvePromptPath(filename);

    // Check if already exists
    try {
      await fs.access(filePath);
      throw new BadRequestException(`Prompt file already exists: ${filename}`);
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      // File doesn't exist, proceed to create
    }

    await fs.mkdir(this.promptsDir, { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
    this.logger.log(`Created prompt file: ${filename}`);
  }

  /**
   * Update an existing prompt file
   */
  async updatePrompt(filename: string, content: string): Promise<void> {
    this.validateFilename(filename);
    const filePath = this.resolvePromptPath(filename);

    try {
      await fs.access(filePath);
    } catch {
      throw new NotFoundException(`Prompt file not found: ${filename}`);
    }

    await fs.writeFile(filePath, content, 'utf-8');
    this.logger.log(`Updated prompt file: ${filename}`);
  }

  /**
   * Delete a prompt file
   */
  async deletePrompt(filename: string): Promise<void> {
    this.validateFilename(filename);
    const filePath = this.resolvePromptPath(filename);

    try {
      await fs.unlink(filePath);
      this.logger.log(`Deleted prompt file: ${filename}`);
    } catch {
      throw new NotFoundException(`Prompt file not found: ${filename}`);
    }
  }

  /**
   * Validate filename to prevent path traversal
   */
  private validateFilename(filename: string): void {
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new BadRequestException('Invalid filename: must not contain path separators or ".."');
    }
    if (!filename.endsWith('.md')) {
      throw new BadRequestException('Prompt files must have .md extension');
    }
    if (!/^[a-zA-Z0-9_-]+\.md$/.test(filename)) {
      throw new BadRequestException('Filename must contain only alphanumeric characters, hyphens, and underscores');
    }
  }

  /**
   * Resolve and validate the full path stays within promptsDir
   */
  private resolvePromptPath(filename: string): string {
    const resolved = path.resolve(this.promptsDir, filename);
    if (!resolved.startsWith(this.promptsDir)) {
      throw new BadRequestException('Path traversal detected');
    }
    return resolved;
  }
}
