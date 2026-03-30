import { Injectable, OnDestroy, computed, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { TaskDefinition, TaskExecution, TaskExecutionStatus } from '../models/task.model';
import { TaskWebSocketService } from './task-websocket.service';

const STORAGE_KEY = 'coding-agent-task-executions';

/**
 * Global task service for managing task definitions and executions.
 * Uses signals for reactive state management and persists execution IDs
 * to localStorage for reconnection on page reload.
 */
@Injectable({
  providedIn: 'root',
})
export class TaskService implements OnDestroy {
  private subscriptions: Subscription[] = [];
  private initialized = false;

  // Task definitions
  private tasksSignal = signal<TaskDefinition[]>([]);

  // Executions state
  private executionsSignal = signal<TaskExecution[]>([]);

  // Dock expansion state
  private expandedIdSignal = signal<string | null>(null);

  // Public computed signals
  readonly tasks = this.tasksSignal.asReadonly();
  readonly executions = this.executionsSignal.asReadonly();
  readonly expandedId = this.expandedIdSignal.asReadonly();

  readonly running = computed(() =>
    this.executionsSignal().filter((e) => e.status === 'running')
  );

  readonly runningCount = computed(() => this.running().length);

  readonly completed = computed(() =>
    this.executionsSignal().filter((e) => e.status === 'completed' || e.status === 'failed' || e.status === 'cancelled')
  );

  readonly hasDock = computed(() => this.executionsSignal().length > 0);

  readonly expandedExecution = computed(() => {
    const id = this.expandedIdSignal();
    if (!id) return null;
    return this.executionsSignal().find((e) => e.id === id) || null;
  });

  constructor(private wsService: TaskWebSocketService) {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    try {
      // Connect to WebSocket
      await this.wsService.connect();

      // Load task definitions
      await this.loadTasks();

      // Load and reconnect to persisted executions
      await this.reconnectPersistedExecutions();

      // Subscribe to WebSocket events
      this.subscriptions.push(
        this.wsService.onTaskStarted.subscribe((event) => {
          this.updateExecution(event.execution);
        }),
        this.wsService.onTaskOutput.subscribe((event) => {
          this.appendOutput(event.executionId, event.line);
        }),
        this.wsService.onTaskCompleted.subscribe((event) => {
          this.updateExecution(event.execution);
        }),
        this.wsService.onTaskFailed.subscribe((event) => {
          this.updateExecution(event.execution);
        }),
        this.wsService.onTaskCancelled.subscribe((event) => {
          this.updateExecution(event.execution);
        }),
        this.wsService.onTaskDismissed.subscribe((event) => {
          this.removeExecution(event.executionId);
        })
      );
    } catch (error) {
      console.error('Failed to initialize TaskService:', error);
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.wsService.disconnect();
  }

  /**
   * Load all available task definitions
   */
  async loadTasks(): Promise<void> {
    try {
      const tasks = await this.wsService.listTasks();
      this.tasksSignal.set(tasks);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  }

  /**
   * Run a task
   */
  async run(task: string, args?: string[]): Promise<string> {
    const { id } = await this.wsService.runTask(task, args);

    // Create a placeholder execution
    const execution: TaskExecution = {
      id,
      task,
      args,
      status: 'pending',
      output: [],
      startedAt: new Date().toISOString(),
    };

    this.executionsSignal.update((execs) => [execution, ...execs]);
    this.persistExecutionIds();

    // Expand the new execution
    this.expandedIdSignal.set(id);

    return id;
  }

  /**
   * Stop a running task (SIGTERM)
   */
  async stop(executionId: string): Promise<void> {
    const result = await this.wsService.stopTask(executionId);
    if (!result.success) {
      console.error('Failed to stop task:', result.error);
    }
  }

  /**
   * Kill a running task (SIGKILL)
   */
  async kill(executionId: string): Promise<void> {
    const result = await this.wsService.killTask(executionId);
    if (!result.success) {
      console.error('Failed to kill task:', result.error);
    }
  }

  /**
   * Dismiss a completed execution
   */
  async dismiss(executionId: string): Promise<void> {
    const result = await this.wsService.dismissExecution(executionId);
    if (result.success) {
      this.removeExecution(executionId);
    } else {
      console.error('Failed to dismiss execution:', result.error);
    }
  }

  /**
   * Clear all completed executions
   */
  async clearCompleted(): Promise<void> {
    const completed = this.completed();
    for (const execution of completed) {
      await this.dismiss(execution.id);
    }
  }

  /**
   * Check if a task is currently running
   */
  isRunning(taskName: string): boolean {
    return this.running().some((e) => e.task === taskName);
  }

  /**
   * Expand an execution in the dock
   */
  expand(executionId: string): void {
    this.expandedIdSignal.set(executionId);
  }

  /**
   * Collapse the expanded execution
   */
  collapse(): void {
    this.expandedIdSignal.set(null);
  }

  /**
   * Toggle expansion
   */
  toggle(executionId: string): void {
    if (this.expandedIdSignal() === executionId) {
      this.collapse();
    } else {
      this.expand(executionId);
    }
  }

  /**
   * Update an execution in the list
   */
  private updateExecution(execution: TaskExecution): void {
    this.executionsSignal.update((execs) => {
      const index = execs.findIndex((e) => e.id === execution.id);
      if (index >= 0) {
        const updated = [...execs];
        // Preserve output if not provided in the update
        if (!execution.output || execution.output.length === 0) {
          execution.output = execs[index].output;
        }
        updated[index] = execution;
        return updated;
      } else {
        return [execution, ...execs];
      }
    });
    this.persistExecutionIds();
  }

  /**
   * Append output to an execution
   */
  private appendOutput(executionId: string, line: string): void {
    this.executionsSignal.update((execs) =>
      execs.map((e) =>
        e.id === executionId ? { ...e, output: [...e.output, line] } : e
      )
    );
  }

  /**
   * Remove an execution from the list
   */
  private removeExecution(executionId: string): void {
    if (this.expandedIdSignal() === executionId) {
      this.collapse();
    }
    this.executionsSignal.update((execs) => execs.filter((e) => e.id !== executionId));
    this.persistExecutionIds();
  }

  /**
   * Persist execution IDs to localStorage
   */
  private persistExecutionIds(): void {
    const ids = this.executionsSignal().map((e) => e.id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  }

  /**
   * Get persisted execution IDs from localStorage
   */
  private getPersistedExecutionIds(): string[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  /**
   * Reconnect to persisted executions
   */
  private async reconnectPersistedExecutions(): Promise<void> {
    const ids = this.getPersistedExecutionIds();
    if (ids.length === 0) return;

    // First, get all current executions from the server
    try {
      const serverExecutions = await this.wsService.getExecutions();
      const serverExecutionMap = new Map(serverExecutions.map((e) => [e.id, e]));

      // For each persisted ID, check if it still exists on the server
      const validExecutions: TaskExecution[] = [];
      for (const id of ids) {
        const serverExecution = serverExecutionMap.get(id);
        if (serverExecution) {
          // Subscribe to updates for this execution
          const execution = await this.wsService.subscribeToExecution(id);
          if (execution) {
            validExecutions.push(execution);
          }
        }
      }

      if (validExecutions.length > 0) {
        this.executionsSignal.set(validExecutions);
        this.persistExecutionIds();
      } else {
        // Clear persisted IDs if none are valid
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.error('Failed to reconnect to persisted executions:', error);
    }
  }
}
