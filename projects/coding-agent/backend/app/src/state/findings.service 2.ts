import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface Finding {
  role: string;
  content: string;
}

@Injectable()
export class FindingsService {
  private readonly logger = new Logger(FindingsService.name);
  private readonly stateRoot: string;

  constructor() {
    const repoRoot = process.env.REPO_ROOT || process.cwd();
    this.stateRoot = path.join(repoRoot, '.the-dev-team', 'state');
  }

  private findingsDir(taskId: string): string {
    return path.join(this.stateRoot, taskId, 'findings');
  }

  async writeFindings(taskId: string, role: string, findings: string): Promise<void> {
    const dir = this.findingsDir(taskId);
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${role}.md`);
    await fs.writeFile(filePath, findings, 'utf-8');
    this.logger.debug(`Wrote findings for ${role} on task ${taskId}`);
  }

  async hasFindings(taskId: string): Promise<boolean> {
    const dir = this.findingsDir(taskId);
    try {
      const files = await fs.readdir(dir);
      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        const content = await fs.readFile(path.join(dir, file), 'utf-8');
        if (content.trim().length > 0) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  async getFindings(taskId: string): Promise<Finding[]> {
    const dir = this.findingsDir(taskId);
    try {
      const files = await fs.readdir(dir);
      const findings: Finding[] = [];

      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        const content = await fs.readFile(path.join(dir, file), 'utf-8');
        if (content.trim().length > 0) {
          findings.push({
            role: path.basename(file, '.md'),
            content,
          });
        }
      }

      return findings;
    } catch {
      return [];
    }
  }

  async clearFindings(taskId: string, role: string): Promise<void> {
    const filePath = path.join(this.findingsDir(taskId), `${role}.md`);
    try {
      await fs.writeFile(filePath, '', 'utf-8');
      this.logger.debug(`Cleared findings for ${role} on task ${taskId}`);
    } catch (err) {
      this.logger.warn(`Could not clear findings for ${role}: ${(err as Error).message}`);
    }
  }

  async clearAllFindings(taskId: string): Promise<void> {
    const dir = this.findingsDir(taskId);
    try {
      const files = await fs.readdir(dir);
      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        await fs.writeFile(path.join(dir, file), '', 'utf-8');
      }
      this.logger.debug(`Cleared all findings for task ${taskId}`);
    } catch (err) {
      this.logger.warn(`Could not clear all findings: ${(err as Error).message}`);
    }
  }
}
