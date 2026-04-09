import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Task, TaskStatus, GateResultSummary } from '../core/interfaces/task.interface';

export interface GateResult {
  gate: string;
  passed: boolean;
  attempt: number;
  notes?: string;
  timestamp: string;
  durationMs?: number;
}

@Injectable()
export class TaskStateService {
  private readonly logger = new Logger(TaskStateService.name);
  private readonly stateRoot: string;
  private readonly historyRoot: string;

  constructor() {
    const repoRoot = process.env.REPO_ROOT || process.cwd();
    this.stateRoot = path.join(repoRoot, '.the-dev-team', 'state');
    this.historyRoot = path.join(repoRoot, '.the-dev-team', 'history', 'state');
  }

  private taskDir(taskId: string): string {
    return path.join(this.stateRoot, taskId);
  }

  async createTaskState(task: Task): Promise<void> {
    const dir = this.taskDir(task.id);
    await fs.mkdir(path.join(dir, 'findings'), { recursive: true });
    await fs.mkdir(path.join(dir, 'gate-results'), { recursive: true });

    const status = {
      id: task.id,
      title: task.title,
      status: task.status,
      branch: task.branch,
      source: task.source,
      priority: task.priority,
      createdAt: task.createdAt,
      updatedAt: new Date().toISOString(),
    };

    await fs.writeFile(
      path.join(dir, 'status.json'),
      JSON.stringify(status, null, 2) + '\n',
      'utf-8',
    );
    this.logger.log(`Created task state for ${task.id}`);
  }

  async updateStatus(taskId: string, status: TaskStatus): Promise<void> {
    const statusPath = path.join(this.taskDir(taskId), 'status.json');

    try {
      const raw = await fs.readFile(statusPath, 'utf-8');
      const data = JSON.parse(raw);
      data.status = status;
      data.updatedAt = new Date().toISOString();
      await fs.writeFile(statusPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
      this.logger.debug(`Updated status for ${taskId} to ${status}`);
    } catch (err) {
      this.logger.error(`Failed to update status for ${taskId}: ${(err as Error).message}`);
      throw err;
    }
  }

  async savePlan(taskId: string, plan: string): Promise<void> {
    const planPath = path.join(this.taskDir(taskId), 'plan.md');
    await fs.writeFile(planPath, plan, 'utf-8');
    this.logger.debug(`Saved plan for ${taskId}`);
  }

  async saveGateResult(taskId: string, result: GateResult): Promise<void> {
    const filePath = path.join(
      this.taskDir(taskId),
      'gate-results',
      `${result.gate}.json`,
    );
    await fs.writeFile(filePath, JSON.stringify(result, null, 2) + '\n', 'utf-8');
    this.logger.debug(`Saved gate result ${result.gate} for ${taskId}`);
  }

  async getTaskState(taskId: string): Promise<Record<string, unknown> | null> {
    const statusPath = path.join(this.taskDir(taskId), 'status.json');
    try {
      const raw = await fs.readFile(statusPath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async getAllGateResults(taskId: string): Promise<GateResult[]> {
    const dir = path.join(this.taskDir(taskId), 'gate-results');
    try {
      const files = await fs.readdir(dir);
      const results: GateResult[] = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const raw = await fs.readFile(path.join(dir, file), 'utf-8');
        results.push(JSON.parse(raw));
      }

      return results;
    } catch {
      return [];
    }
  }

  async save(task: Task): Promise<void> {
    const dir = this.taskDir(task.id);
    await fs.mkdir(dir, { recursive: true });

    const data = {
      ...task,
      updatedAt: new Date().toISOString(),
    };

    await fs.writeFile(
      path.join(dir, 'status.json'),
      JSON.stringify(data, null, 2) + '\n',
      'utf-8',
    );
    this.logger.debug(`Saved full task state for ${task.id}`);
  }

  async archiveTaskState(taskId: string): Promise<void> {
    const src = this.taskDir(taskId);
    const dest = path.join(this.historyRoot, taskId);

    try {
      await fs.mkdir(path.join(this.historyRoot), { recursive: true });
      await fs.rename(src, dest);
      this.logger.log(`Archived task state ${taskId} to history`);
    } catch (err) {
      this.logger.error(`Failed to archive task state ${taskId}: ${(err as Error).message}`);
      throw err;
    }
  }
}
