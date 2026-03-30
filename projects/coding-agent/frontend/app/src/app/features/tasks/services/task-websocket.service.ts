import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Subject, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TaskDefinition, TaskExecution } from '../models/task.model';

export interface TaskStartedEvent {
  execution: TaskExecution;
}

export interface TaskOutputEvent {
  executionId: string;
  line: string;
}

export interface TaskCompletedEvent {
  execution: TaskExecution;
}

export interface TaskFailedEvent {
  execution: TaskExecution;
  error: string;
}

export interface TaskCancelledEvent {
  execution: TaskExecution;
}

export interface TaskDismissedEvent {
  executionId: string;
}

/**
 * WebSocket service for task execution events.
 * Connects to the /tasks namespace and provides observables for task events.
 */
@Injectable({
  providedIn: 'root',
})
export class TaskWebSocketService {
  private socket: Socket | null = null;
  private connected = false;
  private connectionPromise: Promise<void> | null = null;

  // Event subjects
  private taskStartedSubject = new Subject<TaskStartedEvent>();
  private taskOutputSubject = new Subject<TaskOutputEvent>();
  private taskCompletedSubject = new Subject<TaskCompletedEvent>();
  private taskFailedSubject = new Subject<TaskFailedEvent>();
  private taskCancelledSubject = new Subject<TaskCancelledEvent>();
  private taskDismissedSubject = new Subject<TaskDismissedEvent>();

  // Public observables
  readonly onTaskStarted: Observable<TaskStartedEvent> = this.taskStartedSubject.asObservable();
  readonly onTaskOutput: Observable<TaskOutputEvent> = this.taskOutputSubject.asObservable();
  readonly onTaskCompleted: Observable<TaskCompletedEvent> = this.taskCompletedSubject.asObservable();
  readonly onTaskFailed: Observable<TaskFailedEvent> = this.taskFailedSubject.asObservable();
  readonly onTaskCancelled: Observable<TaskCancelledEvent> = this.taskCancelledSubject.asObservable();
  readonly onTaskDismissed: Observable<TaskDismissedEvent> = this.taskDismissedSubject.asObservable();

  connect(): Promise<void> {
    if (this.connected) return Promise.resolve();
    if (this.connectionPromise) return this.connectionPromise;

    this.connectionPromise = new Promise((resolve, reject) => {
      const wsUrl = environment.wsUrl;
      this.socket = io(`${wsUrl}/tasks`, {
        transports: ['websocket'],
        autoConnect: true,
      });

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 5000);

      this.socket.on('connect', () => {
        clearTimeout(timeout);
        this.connected = true;
        console.log('Tasks WebSocket connected');
        resolve();
      });

      this.socket.on('disconnect', () => {
        this.connected = false;
        console.log('Tasks WebSocket disconnected');
      });

      this.socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        console.error('Tasks WebSocket connection error:', error);
        reject(error);
      });

      // Listen for task events
      this.socket.on('task:started', (event: TaskStartedEvent) => {
        this.taskStartedSubject.next(event);
      });

      this.socket.on('task:output', (event: TaskOutputEvent) => {
        this.taskOutputSubject.next(event);
      });

      this.socket.on('task:completed', (event: TaskCompletedEvent) => {
        this.taskCompletedSubject.next(event);
      });

      this.socket.on('task:failed', (event: TaskFailedEvent) => {
        this.taskFailedSubject.next(event);
      });

      this.socket.on('task:cancelled', (event: TaskCancelledEvent) => {
        this.taskCancelledSubject.next(event);
      });

      this.socket.on('task:dismissed', (event: TaskDismissedEvent) => {
        this.taskDismissedSubject.next(event);
      });
    });

    return this.connectionPromise;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.connectionPromise = null;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  /**
   * List all available tasks
   */
  listTasks(): Promise<TaskDefinition[]> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('Not connected'));
        return;
      }

      this.socket.emit('task:list', (tasks: TaskDefinition[]) => {
        resolve(tasks);
      });
    });
  }

  /**
   * Run a task
   */
  runTask(task: string, args?: string[]): Promise<{ id: string }> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('Not connected'));
        return;
      }

      this.socket.emit('task:run', { task, args }, (response: { id: string }) => {
        resolve(response);
      });
    });
  }

  /**
   * Stop a running task (SIGTERM)
   */
  stopTask(executionId: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('Not connected'));
        return;
      }

      this.socket.emit('task:stop', executionId, (response: { success: boolean; error?: string }) => {
        resolve(response);
      });
    });
  }

  /**
   * Kill a running task (SIGKILL)
   */
  killTask(executionId: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('Not connected'));
        return;
      }

      this.socket.emit('task:kill', executionId, (response: { success: boolean; error?: string }) => {
        resolve(response);
      });
    });
  }

  /**
   * Subscribe to an execution's updates (for reconnection)
   */
  subscribeToExecution(executionId: string): Promise<TaskExecution | null> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('Not connected'));
        return;
      }

      this.socket.emit('task:subscribe', executionId, (execution: TaskExecution | null) => {
        resolve(execution);
      });
    });
  }

  /**
   * Unsubscribe from an execution's updates
   */
  unsubscribeFromExecution(executionId: string): void {
    if (this.socket && this.connected) {
      this.socket.emit('task:unsubscribe', executionId);
    }
  }

  /**
   * Dismiss (delete) an execution
   */
  dismissExecution(executionId: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('Not connected'));
        return;
      }

      this.socket.emit('task:dismiss', executionId, (response: { success: boolean; error?: string }) => {
        resolve(response);
      });
    });
  }

  /**
   * Get all executions
   */
  getExecutions(): Promise<TaskExecution[]> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('Not connected'));
        return;
      }

      this.socket.emit('task:executions', (executions: TaskExecution[]) => {
        resolve(executions);
      });
    });
  }
}
