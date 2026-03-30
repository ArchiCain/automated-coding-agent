import { Injectable, Logger, OnModuleInit, OnModuleDestroy, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChildProcess, spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  TaskDefinition,
  TaskExecution,
  TaskExecutionIndex,
  TaskExecutionStatus,
  TaskListOutput,
  TaskLogsResponse,
} from '../models/task.model';

const TASK_CACHE_TTL_MS = 30_000; // 30 seconds

@Injectable()
export class TaskService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TaskService.name);
  private executions: Map<string, TaskExecution> = new Map();
  private processes: Map<string, ChildProcess> = new Map();
  private tasksDir: string;
  private repoRoot: string;

  // Cached task list for validation
  private cachedTasks: TaskDefinition[] | null = null;
  private cachedTasksAt = 0;

  constructor(private readonly eventEmitter: EventEmitter2) {
    // Navigate from dist/features/task-runner/services to repo root
    this.repoRoot = process.env.REPO_ROOT || path.resolve(__dirname, '../../../../../../../');
    this.tasksDir = path.join(this.repoRoot, '.tasks');
  }

  async onModuleInit(): Promise<void> {
    await this.ensureTasksDir();
    await this.loadExecutionsFromDisk();
  }

  async onModuleDestroy(): Promise<void> {
    // Kill any running processes on shutdown
    for (const [id, process] of this.processes) {
      this.logger.warn(`Killing process ${id} on shutdown`);
      process.kill('SIGTERM');
    }
  }

  private async ensureTasksDir(): Promise<void> {
    try {
      await fs.mkdir(this.tasksDir, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create tasks directory', error);
    }
  }

  /**
   * List all available tasks by running `task --list --json`
   */
  async listTasks(): Promise<TaskDefinition[]> {
    return new Promise((resolve, reject) => {
      const child = spawn('task', ['--list', '--json'], {
        cwd: this.repoRoot,
        shell: true,
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          this.logger.error(`task --list failed: ${stderr}`);
          reject(new Error(`Failed to list tasks: ${stderr}`));
          return;
        }

        try {
          const parsed: TaskListOutput = JSON.parse(stdout);
          const tasks: TaskDefinition[] = parsed.tasks.map((t) => ({
            name: t.name,
            desc: t.desc,
            summary: t.summary || undefined,
            location: t.location,
          }));
          resolve(tasks);
        } catch (error) {
          this.logger.error(`Failed to parse task list: ${error}`);
          reject(new Error('Failed to parse task list'));
        }
      });

      child.on('error', (error) => {
        this.logger.error(`Failed to spawn task: ${error}`);
        reject(error);
      });
    });
  }

  /**
   * Validate that a task name exists in the Taskfile definitions.
   * Uses a cached task list to avoid shelling out on every call.
   */
  private async validateTaskName(task: string): Promise<void> {
    const now = Date.now();
    if (!this.cachedTasks || (now - this.cachedTasksAt) > TASK_CACHE_TTL_MS) {
      this.cachedTasks = await this.listTasks();
      this.cachedTasksAt = now;
    }

    const found = this.cachedTasks.some((t) => t.name === task);
    if (!found) {
      throw new BadRequestException(
        `Task "${task}" not found in Taskfile. Only tasks defined in Taskfile.yml can be executed.`,
      );
    }
  }

  /**
   * Create a new task execution
   */
  async create(task: string, args?: string[]): Promise<TaskExecution> {
    // Validate task name against Taskfile definitions
    await this.validateTaskName(task);

    const id = uuidv4().slice(0, 8);
    const now = new Date().toISOString();

    const execution: TaskExecution = {
      id,
      task,
      args,
      status: 'pending',
      output: [],
      startedAt: now,
    };

    this.executions.set(id, execution);
    await this.persistExecution(execution);
    await this.updateExecutionIndex();

    this.logger.log(`Created task execution ${id} for task: ${task}`);
    return execution;
  }

  /**
   * Execute a task
   */
  async execute(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    const cmdArgs = [execution.task];
    if (execution.args && execution.args.length > 0) {
      cmdArgs.push('--');
      cmdArgs.push(...execution.args);
    }

    this.logger.log(`Executing: task ${cmdArgs.join(' ')}`);

    const child = spawn('task', cmdArgs, {
      cwd: this.repoRoot,
      shell: true,
      env: { ...process.env, FORCE_COLOR: '1' },
    });

    execution.status = 'running';
    execution.pid = child.pid;
    await this.persistExecution(execution);
    await this.updateExecutionIndex();

    this.processes.set(executionId, child);
    this.eventEmitter.emit('task:started', { execution });

    const handleOutput = async (data: Buffer) => {
      const lines = data.toString().split('\n').filter((l) => l.length > 0);
      for (const line of lines) {
        execution.output.push(line);
        await this.appendLog(executionId, line);
        this.eventEmitter.emit('task:output', { executionId, line });
      }
    };

    child.stdout?.on('data', handleOutput);
    child.stderr?.on('data', handleOutput);

    child.on('close', async (code) => {
      this.processes.delete(executionId);
      execution.exitCode = code ?? undefined;
      execution.completedAt = new Date().toISOString();

      if (execution.status === 'cancelled') {
        // Already marked as cancelled
        await this.persistExecution(execution);
        await this.updateExecutionIndex();
        this.eventEmitter.emit('task:cancelled', { execution });
      } else if (code === 0) {
        execution.status = 'completed';
        await this.persistExecution(execution);
        await this.updateExecutionIndex();
        this.eventEmitter.emit('task:completed', { execution });
        this.logger.log(`Task execution ${executionId} completed successfully`);
      } else {
        execution.status = 'failed';
        execution.error = `Exited with code ${code}`;
        await this.persistExecution(execution);
        await this.updateExecutionIndex();
        this.eventEmitter.emit('task:failed', { execution, error: execution.error });
        this.logger.error(`Task execution ${executionId} failed with code ${code}`);
      }
    });

    child.on('error', async (error) => {
      this.processes.delete(executionId);
      execution.status = 'failed';
      execution.error = error.message;
      execution.completedAt = new Date().toISOString();

      await this.persistExecution(execution);
      await this.updateExecutionIndex();

      this.eventEmitter.emit('task:failed', { execution, error: error.message });
      this.logger.error(`Task execution ${executionId} error: ${error.message}`);
    });
  }

  /**
   * Stop a running task (SIGTERM)
   */
  async stop(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    const process = this.processes.get(executionId);
    if (!process) {
      throw new Error(`No running process for execution ${executionId}`);
    }

    execution.status = 'cancelled';
    process.kill('SIGTERM');
    this.logger.log(`Sent SIGTERM to execution ${executionId}`);
  }

  /**
   * Kill a running task (SIGKILL)
   */
  async kill(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    const process = this.processes.get(executionId);
    if (!process) {
      throw new Error(`No running process for execution ${executionId}`);
    }

    execution.status = 'cancelled';
    process.kill('SIGKILL');
    this.logger.log(`Sent SIGKILL to execution ${executionId}`);
  }

  /**
   * Get a single execution
   */
  get(executionId: string): TaskExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Get all executions
   */
  getAll(filter?: { status?: TaskExecutionStatus }): TaskExecution[] {
    let executions = Array.from(this.executions.values());

    if (filter?.status) {
      executions = executions.filter((e) => e.status === filter.status);
    }

    // Sort by startedAt descending (newest first)
    return executions.sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  }

  /**
   * Get logs for an execution
   */
  async getLogs(executionId: string, offset = 0, limit = 1000): Promise<TaskLogsResponse> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    const total = execution.output.length;
    const logs = execution.output.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return { logs, total, hasMore };
  }

  /**
   * Dismiss (delete) an execution
   */
  async dismiss(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    // Can't dismiss running executions
    if (execution.status === 'running') {
      throw new Error(`Cannot dismiss running execution ${executionId}`);
    }

    // Remove from memory
    this.executions.delete(executionId);

    // Remove from disk
    const executionDir = path.join(this.tasksDir, executionId);
    try {
      await fs.rm(executionDir, { recursive: true });
    } catch (error) {
      this.logger.warn(`Failed to remove execution directory: ${error}`);
    }

    await this.updateExecutionIndex();
    this.eventEmitter.emit('task:dismissed', { executionId });
    this.logger.log(`Dismissed execution ${executionId}`);
  }

  /**
   * Append a log line to the execution's log file
   */
  private async appendLog(executionId: string, line: string): Promise<void> {
    try {
      const logsFile = path.join(this.tasksDir, executionId, 'output.jsonl');
      await fs.appendFile(
        logsFile,
        JSON.stringify({ timestamp: new Date().toISOString(), line }) + '\n'
      );
    } catch (error) {
      // Non-blocking, just log warning
      this.logger.warn(`Failed to append log for ${executionId}: ${error}`);
    }
  }

  /**
   * Persist an execution to disk
   */
  private async persistExecution(execution: TaskExecution): Promise<void> {
    try {
      const executionDir = path.join(this.tasksDir, execution.id);
      await fs.mkdir(executionDir, { recursive: true });

      const executionFile = path.join(executionDir, 'execution.json');
      await fs.writeFile(executionFile, JSON.stringify(execution, null, 2));
    } catch (error) {
      this.logger.error(`Failed to persist execution ${execution.id}`, error);
    }
  }

  /**
   * Update the execution index file
   */
  private async updateExecutionIndex(): Promise<void> {
    try {
      const index: TaskExecutionIndex[] = Array.from(this.executions.values()).map((e) => ({
        id: e.id,
        task: e.task,
        status: e.status,
        startedAt: e.startedAt,
        completedAt: e.completedAt,
      }));

      const indexFile = path.join(this.tasksDir, 'index.json');
      await fs.writeFile(indexFile, JSON.stringify(index, null, 2));
    } catch (error) {
      this.logger.error('Failed to update execution index', error);
    }
  }

  /**
   * Load executions from disk on startup
   */
  private async loadExecutionsFromDisk(): Promise<void> {
    try {
      const entries = await fs.readdir(this.tasksDir, { withFileTypes: true });
      const executionDirs = entries.filter((e) => e.isDirectory());

      for (const dir of executionDirs) {
        const executionFile = path.join(this.tasksDir, dir.name, 'execution.json');
        try {
          const content = await fs.readFile(executionFile, 'utf-8');
          const execution: TaskExecution = JSON.parse(content);

          // Load logs from output.jsonl if they exist
          const logsFile = path.join(this.tasksDir, dir.name, 'output.jsonl');
          try {
            const logsContent = await fs.readFile(logsFile, 'utf-8');
            const logLines = logsContent
              .trim()
              .split('\n')
              .filter((l) => l)
              .map((l) => JSON.parse(l).line);
            execution.output = logLines;
          } catch {
            // No logs file or empty
          }

          // If execution was running when we shut down, mark it as failed
          if (execution.status === 'running' || execution.status === 'pending') {
            execution.status = 'failed';
            execution.error = 'Process terminated unexpectedly (server restart)';
            execution.completedAt = new Date().toISOString();
            await this.persistExecution(execution);
          }

          this.executions.set(execution.id, execution);
          this.logger.debug(`Loaded execution ${execution.id} from disk`);
        } catch (error) {
          this.logger.warn(`Failed to load execution from ${dir.name}`, error);
        }
      }

      this.logger.log(`Loaded ${this.executions.size} executions from disk`);
    } catch (error) {
      // Tasks directory might not exist yet
      this.logger.debug('No existing executions to load');
    }
  }
}
