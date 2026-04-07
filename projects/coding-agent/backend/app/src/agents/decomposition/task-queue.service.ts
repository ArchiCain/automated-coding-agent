import { Injectable, Logger } from '@nestjs/common';
import { Task } from '../../core/interfaces/task.interface';
import { TaskNode, TaskTree } from './task-tree.interface';

export interface QueueStatus {
  total: number;
  queued: number;
  active: number;
  completed: number;
  failed: number;
}

/**
 * Dependency-aware task queue that flattens a TaskTree into
 * executable leaf tasks and serves them in dependency order.
 */
@Injectable()
export class TaskQueueService {
  private readonly logger = new Logger(TaskQueueService.name);
  private queue: Task[] = [];

  addTree(tree: TaskTree): void {
    const leafTasks = this.flattenTree(tree.rootNode);
    this.queue.push(...leafTasks);
    this.updateReadiness();
    this.logger.log(
      `Added tree "${tree.title}" — ${leafTasks.length} leaf tasks queued`,
    );
  }

  addTask(task: Task): void {
    this.queue.push(task);
    this.updateReadiness();
  }

  getNextReady(): Task | null {
    return (
      this.queue.find(
        (t) => t.status === 'queued' && this.areDependenciesMet(t),
      ) ?? null
    );
  }

  getTask(taskId: string): Task | undefined {
    return this.queue.find((t) => t.id === taskId);
  }

  markCompleted(taskId: string): void {
    const task = this.queue.find((t) => t.id === taskId);
    if (task) {
      task.status = 'completed';
      task.completedAt = new Date();
      this.updateReadiness();
      this.logger.log(`Task ${taskId} marked completed`);
    }
  }

  markFailed(taskId: string): void {
    const task = this.queue.find((t) => t.id === taskId);
    if (task) {
      task.status = 'failed';
      task.completedAt = new Date();
      this.logger.warn(`Task ${taskId} marked failed`);
    }
  }

  hasWork(): boolean {
    return this.queue.some(
      (t) =>
        t.status === 'queued' ||
        t.status === 'assigned' ||
        t.status === 'setting_up' ||
        t.status === 'implementing' ||
        t.status === 'validating' ||
        t.status === 'submitting',
    );
  }

  getQueueStatus(): QueueStatus {
    const activeStatuses = [
      'assigned',
      'setting_up',
      'implementing',
      'validating',
      'submitting',
    ];
    return {
      total: this.queue.length,
      queued: this.queue.filter((t) => t.status === 'queued').length,
      active: this.queue.filter((t) => activeStatuses.includes(t.status))
        .length,
      completed: this.queue.filter((t) => t.status === 'completed').length,
      failed: this.queue.filter((t) => t.status === 'failed').length,
    };
  }

  private areDependenciesMet(task: Task): boolean {
    return task.dependencies.every((depId) => {
      const dep = this.queue.find((t) => t.id === depId);
      return dep?.status === 'completed';
    });
  }

  private updateReadiness(): void {
    // Readiness is checked lazily in getNextReady.
    // This hook exists for future eager notification (e.g. event emission).
  }

  private flattenTree(node: TaskNode, parentDeps: string[] = []): Task[] {
    if (!node) {
      return [];
    }

    const combinedDeps = [...parentDeps, ...node.dependencies];

    if (node.type === 'task' || !node.children || node.children.length === 0) {
      return [
        {
          id: node.id,
          title: node.title,
          description: node.description ?? '',
          source: 'decomposition' as const,
          status: 'queued' as const,
          priority: 0,
          branch: '',
          touchesFrontend: this.estimateFrontendTouch(node),
          dependencies: combinedDeps,
          retryBudget: 3,
          estimatedFiles: node.estimatedFiles ?? [],
          createdAt: new Date(),
          cost: 0,
        },
      ];
    }

    const tasks: Task[] = [];
    for (const child of node.children) {
      tasks.push(...this.flattenTree(child, combinedDeps));
    }
    return tasks;
  }

  private estimateFrontendTouch(node: TaskNode): boolean {
    const frontendIndicators = [
      'frontend',
      'react',
      'component',
      'ui',
      'page',
      'view',
      'css',
      'style',
    ];
    const text = `${node.title} ${node.description ?? ''}`.toLowerCase();
    return frontendIndicators.some((indicator) => text.includes(indicator));
  }
}
