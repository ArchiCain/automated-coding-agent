import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { spawn, ChildProcess } from 'child_process';
import * as readline from 'readline';
import { TaskRun, TaskRunInfo, TaskStatus, ALLOWED_TASKS } from './task-runner.types';

@Injectable()
export class TaskRunnerService {
  private readonly logger = new Logger(TaskRunnerService.name);
  private readonly tasks = new Map<string, TaskRun>();
  private readonly processes = new Map<string, ChildProcess>();
  private readonly repoRoot: string;

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.repoRoot = process.env.REPO_ROOT || '/workspace';
  }

  startTask(taskName: string, vars?: Record<string, string>): TaskRunInfo {
    if (!ALLOWED_TASKS.includes(taskName)) {
      throw new BadRequestException(`Task "${taskName}" is not allowed`);
    }

    const id = uuidv4();
    const taskVars = vars || {};

    const task: TaskRun = {
      id,
      taskName,
      vars: taskVars,
      status: 'running',
      startedAt: new Date(),
      output: [],
    };

    this.tasks.set(id, task);

    // Build args: task name + VAR=value pairs
    const args = [taskName];
    for (const [key, value] of Object.entries(taskVars)) {
      args.push(`${key}=${value}`);
    }

    this.logger.log(`Starting task ${id}: task ${args.join(' ')}`);

    const child = spawn('task', args, {
      cwd: this.repoRoot,
      env: { ...process.env, REPO_ROOT: this.repoRoot },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.processes.set(id, child);

    // Stream stdout line-by-line
    if (child.stdout) {
      const rl = readline.createInterface({ input: child.stdout });
      rl.on('line', (line) => {
        task.output.push(line);
        this.eventEmitter.emit('task-runner.output', {
          taskId: id,
          line,
          stream: 'stdout',
        });
      });
    }

    // Stream stderr line-by-line
    if (child.stderr) {
      const rl = readline.createInterface({ input: child.stderr });
      rl.on('line', (line) => {
        task.output.push(line);
        this.eventEmitter.emit('task-runner.output', {
          taskId: id,
          line,
          stream: 'stderr',
        });
      });
    }

    child.on('close', (code) => {
      task.exitCode = code ?? 1;
      task.finishedAt = new Date();
      task.status = task.status === 'cancelled' ? 'cancelled' : code === 0 ? 'completed' : 'failed';
      this.processes.delete(id);

      this.logger.log(`Task ${id} finished: ${task.status} (exit ${task.exitCode})`);

      this.eventEmitter.emit('task-runner.status', {
        taskId: id,
        status: task.status,
        exitCode: task.exitCode,
      });
    });

    child.on('error', (err) => {
      task.status = 'failed';
      task.finishedAt = new Date();
      task.output.push(`Process error: ${err.message}`);
      this.processes.delete(id);

      this.logger.error(`Task ${id} process error: ${err.message}`);

      this.eventEmitter.emit('task-runner.output', {
        taskId: id,
        line: `Process error: ${err.message}`,
        stream: 'stderr',
      });
      this.eventEmitter.emit('task-runner.status', {
        taskId: id,
        status: 'failed',
        exitCode: -1,
      });
    });

    // Notify listeners of new task
    this.eventEmitter.emit('task-runner.status', {
      taskId: id,
      status: 'running',
    });

    return this.toTaskRunInfo(task);
  }

  cancelTask(taskId: string): void {
    const task = this.getTaskInternal(taskId);

    if (task.status !== 'running') {
      throw new BadRequestException(`Task "${taskId}" is not running`);
    }

    const child = this.processes.get(taskId);
    if (child) {
      task.status = 'cancelled';
      child.kill('SIGTERM');

      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (this.processes.has(taskId)) {
          child.kill('SIGKILL');
        }
      }, 5000);

      this.logger.log(`Task ${taskId} cancellation requested`);
    }
  }

  getTask(taskId: string): TaskRunInfo & { output: string[] } {
    const task = this.getTaskInternal(taskId);
    return { ...this.toTaskRunInfo(task), output: [...task.output] };
  }

  listTasks(): TaskRunInfo[] {
    return [...this.tasks.values()].map((t) => this.toTaskRunInfo(t));
  }

  getOutput(taskId: string): string[] {
    const task = this.getTaskInternal(taskId);
    return [...task.output];
  }

  getAllowedTasks(): string[] {
    return [...ALLOWED_TASKS];
  }

  dismissTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    if (task.status === 'running') {
      throw new BadRequestException(`Cannot dismiss a running task. Cancel it first.`);
    }

    this.tasks.delete(taskId);
    this.logger.log(`Task ${taskId} dismissed`);
  }

  private getTaskInternal(taskId: string): TaskRun {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new NotFoundException(`Task "${taskId}" not found`);
    }
    return task;
  }

  private toTaskRunInfo(task: TaskRun): TaskRunInfo {
    return {
      id: task.id,
      taskName: task.taskName,
      vars: task.vars,
      status: task.status,
      startedAt: task.startedAt.toISOString(),
      finishedAt: task.finishedAt?.toISOString(),
      exitCode: task.exitCode,
    };
  }
}
