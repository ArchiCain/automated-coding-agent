import { Injectable, Logger } from '@nestjs/common';
import { AgentSlot } from '../../core/interfaces/agent-slot.interface';
import { Task, TaskResult } from '../../core/interfaces/task.interface';
import { DevTeamConfigService } from '../../config/dev-team-config.service';
import { SessionManagerService } from '../../core/session-manager.service';
import { TranscriptWriterService } from '../../history/transcript-writer.service';
import { TaskQueueService } from './task-queue.service';

/**
 * Concurrent agent pool that pulls tasks from the TaskQueueService,
 * respects dependency ordering, detects file conflicts between
 * concurrently-running tasks, and manages agent slot lifecycle.
 */
@Injectable()
export class ConcurrentPoolService {
  private readonly logger = new Logger(ConcurrentPoolService.name);
  private readonly slots: AgentSlot[];
  private readonly executing = new Map<string, Promise<TaskResult>>();

  constructor(
    private readonly config: DevTeamConfigService,
    private readonly sessionManager: SessionManagerService,
    private readonly taskQueue: TaskQueueService,
    private readonly transcriptWriter: TranscriptWriterService,
  ) {
    const maxConcurrent = this.config.maxConcurrentAgents;
    this.slots = Array.from({ length: maxConcurrent }, (_, i) => ({
      id: i,
      status: 'idle' as const,
    }));
    this.logger.log(
      `Concurrent pool initialized with ${maxConcurrent} slots`,
    );
  }

  async processQueue(): Promise<void> {
    while (this.taskQueue.hasWork()) {
      const idleSlot = this.slots.find((s) => s.status === 'idle');
      if (!idleSlot) {
        // All slots busy — wait for any task to finish
        if (this.executing.size > 0) {
          await Promise.race([...this.executing.values()]).catch(() => {
            // Individual failures are handled in executeInSlot
          });
        }
        continue;
      }

      const task = this.taskQueue.getNextReady();
      if (!task) {
        if (this.executing.size > 0) {
          // No ready tasks but some are still running — wait for progress
          await Promise.race([...this.executing.values()]).catch(() => {
            // Individual failures are handled in executeInSlot
          });
        } else {
          // No ready tasks and nothing executing — deadlock or all done
          break;
        }
        continue;
      }

      if (this.hasFileConflict(task)) {
        // Skip this task for now; the loop will re-check after
        // a running task completes and frees the conflicting files.
        if (this.executing.size > 0) {
          await Promise.race([...this.executing.values()]).catch(() => {});
        } else {
          break;
        }
        continue;
      }

      // Assign task to slot
      idleSlot.status = 'active';
      idleSlot.taskId = task.id;
      idleSlot.startedAt = new Date();
      task.status = 'assigned';

      const promise = this.executeInSlot(idleSlot, task);
      this.executing.set(task.id, promise);

      this.logger.log(
        `Assigned task "${task.id}" to slot ${idleSlot.id} ` +
          `(${this.executing.size}/${this.slots.length} active)`,
      );
    }

    // Wait for all in-flight tasks to settle
    if (this.executing.size > 0) {
      await Promise.allSettled([...this.executing.values()]);
    }

    const status = this.taskQueue.getQueueStatus();
    this.logger.log(
      `Queue processing complete — ` +
        `${status.completed} completed, ${status.failed} failed, ` +
        `${status.queued} remaining`,
    );
  }

  private async executeInSlot(
    slot: AgentSlot,
    task: Task,
  ): Promise<TaskResult> {
    const session = this.sessionManager.createSession(task.id, 'implementer');

    try {
      task.status = 'implementing';
      task.startedAt = new Date();

      await this.transcriptWriter.logEvent(task.id, {
        type: 'task_started',
        slotId: slot.id,
        sessionId: session.id,
      });

      // Placeholder: the actual execution loop integration will be
      // wired when ExecutionLoopService is implemented.
      // For now, mark as completed after session setup.
      this.logger.log(
        `Executing task "${task.id}" in slot ${slot.id} (session ${session.id})`,
      );

      this.sessionManager.completeSession(session.id, {
        status: 'completed',
        cost: task.cost,
      });

      this.taskQueue.markCompleted(task.id);

      await this.transcriptWriter.logEvent(task.id, {
        type: 'task_completed',
        slotId: slot.id,
        sessionId: session.id,
      });

      return { status: 'completed', cost: task.cost };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Task "${task.id}" failed in slot ${slot.id}: ${errorMessage}`,
      );

      this.sessionManager.completeSession(session.id, {
        status: 'failed',
        cost: task.cost,
      });

      this.taskQueue.markFailed(task.id);

      await this.transcriptWriter.logEvent(task.id, {
        type: 'task_failed',
        slotId: slot.id,
        sessionId: session.id,
        error: errorMessage,
      });

      return { status: 'failed', error: errorMessage, cost: task.cost };
    } finally {
      slot.status = 'idle';
      slot.taskId = undefined;
      slot.worktreePath = undefined;
      slot.namespace = undefined;
      slot.currentRole = undefined;
      slot.startedAt = undefined;
      this.executing.delete(task.id);
    }
  }

  /**
   * Checks whether any currently-executing task overlaps with the
   * candidate task's estimated files, preventing concurrent writes
   * to the same file.
   */
  private hasFileConflict(task: Task): boolean {
    if (!task.estimatedFiles?.length) {
      return false;
    }

    for (const [activeTaskId] of this.executing) {
      const activeTask = this.taskQueue.getTask(activeTaskId);
      if (!activeTask?.estimatedFiles?.length) {
        continue;
      }
      const overlap = task.estimatedFiles.some((f) =>
        activeTask.estimatedFiles!.includes(f),
      );
      if (overlap) {
        this.logger.debug(
          `File conflict detected between task "${task.id}" ` +
            `and active task "${activeTaskId}"`,
        );
        return true;
      }
    }
    return false;
  }

  getSlots(): AgentSlot[] {
    return [...this.slots];
  }

  getActiveCount(): number {
    return this.slots.filter((s) => s.status === 'active').length;
  }
}
