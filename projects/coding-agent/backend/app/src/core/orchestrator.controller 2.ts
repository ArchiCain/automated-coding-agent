import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { TaskIntakeService } from './task-intake.service';
import { AgentPoolService } from './agent-pool.service';
import { EnvironmentManagerService } from './environment-manager.service';
import { CreateTaskInput } from './interfaces/task.interface';

@Controller('orchestrator')
export class OrchestratorController {
  private readonly repoRoot: string;

  constructor(
    private readonly taskIntake: TaskIntakeService,
    private readonly agentPool: AgentPoolService,
    private readonly environmentManager: EnvironmentManagerService,
  ) {
    // Find repo root
    let dir = process.cwd();
    while (dir !== path.dirname(dir)) {
      try {
        require('fs').accessSync(path.join(dir, '.git'));
        break;
      } catch { dir = path.dirname(dir); }
    }
    this.repoRoot = dir;
  }

  // ── Tasks ──

  @Post('tasks')
  @HttpCode(HttpStatus.CREATED)
  async createTask(@Body() input: CreateTaskInput) {
    return this.taskIntake.submitTask(input);
  }

  @Get('tasks')
  getAllTasks() {
    return this.taskIntake.getAllTasks();
  }

  @Get('tasks/:id')
  getTask(@Param('id') id: string) {
    const task = this.taskIntake.getTask(id);
    if (!task) {
      throw new NotFoundException(`Task ${id} not found`);
    }
    return task;
  }

  @Delete('tasks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTask(@Param('id') id: string) {
    const deleted = this.taskIntake.deleteTask(id);
    if (!deleted) {
      throw new NotFoundException(`Task ${id} not found`);
    }
  }

  // ── Agents ──

  @Get('agents')
  getAgentSlots() {
    return this.agentPool.getAllSlots();
  }

  // ── History ──

  @Get('history/tasks')
  async getHistoryTasks() {
    // Return all tasks (current in-memory + completed from worktree state files)
    const tasks = this.taskIntake.getAllTasks();

    // Also scan worktrees for completed task state
    const worktreesDir = path.join(this.repoRoot, '.worktrees');
    try {
      const entries = await fs.readdir(worktreesDir);
      for (const entry of entries) {
        // Skip if we already have this task in memory
        if (tasks.find((t) => t.id === entry)) continue;

        const taskJsonPath = path.join(
          worktreesDir, entry, '.the-dev-team', 'state', entry, 'task.json',
        );
        try {
          const data = JSON.parse(await fs.readFile(taskJsonPath, 'utf-8'));
          tasks.push(data);
        } catch {
          // No task.json in this worktree
        }
      }
    } catch {
      // No .worktrees directory
    }

    return tasks;
  }

  @Get('history/sessions/:taskId')
  async getSessionTranscripts(@Param('taskId') taskId: string) {
    // Look for transcripts in the worktree
    const transcriptDir = path.join(
      this.repoRoot, '.worktrees', taskId,
      '.the-dev-team', 'state', taskId, 'transcripts',
    );

    try {
      const files = await fs.readdir(transcriptDir);
      const sessions = [];

      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue;
        const content = await fs.readFile(path.join(transcriptDir, file), 'utf-8');
        const lines = content.trim().split('\n').filter(Boolean);
        const events = lines.map((line) => {
          try { return JSON.parse(line); } catch { return null; }
        }).filter(Boolean);

        const [role, sessionId] = file.replace('.jsonl', '').split('-', 2);
        sessions.push({
          role,
          sessionId: sessionId || file,
          filename: file,
          eventCount: events.length,
          events,
        });
      }

      return sessions;
    } catch {
      return [];
    }
  }

  // ── Environments ──

  @Get('environments')
  getEnvironments() {
    return this.environmentManager.getTrackedEnvironments();
  }

  @Get('environments/:taskId/health')
  async getEnvironmentHealth(@Param('taskId') taskId: string) {
    return this.environmentManager.checkHealth(taskId);
  }

  @Delete('environments/:taskId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async destroyEnvironment(@Param('taskId') taskId: string) {
    await this.environmentManager.destroyEnvironment(taskId);
  }
}
