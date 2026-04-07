import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ExecutionLoopService } from './execution-loop.service';
import { AgentPoolService } from '../core/agent-pool.service';
import { Task } from '../core/interfaces/task.interface';
import { DashboardGateway } from '../gateway/dashboard.gateway';
import { TaskStateService } from '../state/task-state.service';

@Injectable()
export class TaskExecutorListener {
  private readonly logger = new Logger(TaskExecutorListener.name);

  constructor(
    private readonly executionLoop: ExecutionLoopService,
    private readonly agentPool: AgentPoolService,
    private readonly dashboardGateway: DashboardGateway,
    private readonly taskState: TaskStateService,
  ) {}

  @OnEvent('agent.task.assigned')
  async handleTaskAssigned(payload: {
    slotId: number;
    taskId: string;
    task: Task;
  }): Promise<void> {
    const { slotId, task } = payload;

    this.logger.log(
      `Slot ${slotId} executing task ${task.id}: "${task.title}"`,
    );

    try {
      // Notify dashboard
      this.dashboardGateway.emitTaskUpdate(task);

      // Execute the full pipeline
      const result = await this.executionLoop.execute(task);

      this.logger.log(
        `Task ${task.id} finished with status=${result.status}, cost=$${result.cost.toFixed(4)}`,
      );

      // Update task status
      task.status = result.status === 'completed' ? 'completed' : 'failed';
      task.cost = result.cost;
      task.completedAt = new Date();

      // Persist final task state to on-disk state directory and history
      await this.persistFinalState(task);

      // Notify dashboard of completion
      this.dashboardGateway.emitTaskUpdate(task);
    } catch (err) {
      this.logger.error(
        `Task ${task.id} threw unexpectedly: ${(err as Error).message}`,
        (err as Error).stack,
      );
      task.status = 'failed';

      // Persist failure state
      await this.persistFinalState(task);

      this.dashboardGateway.emitTaskUpdate(task);
    } finally {
      // Always release the slot
      this.agentPool.releaseSlot(slotId);
    }
  }

  /**
   * Persist the final task state to the on-disk state directory
   * and archive a copy to .the-dev-team/history/.
   */
  private async persistFinalState(task: Task): Promise<void> {
    try {
      await this.taskState.save(task);
      this.logger.debug(`Persisted final state for task ${task.id}`);
    } catch (err) {
      this.logger.warn(
        `Failed to persist final task state for ${task.id}: ${(err as Error).message}`,
      );
    }

    try {
      await this.taskState.archiveTaskState(task.id);
      this.logger.debug(`Archived task state for ${task.id} to history`);
    } catch (err) {
      this.logger.warn(
        `Failed to archive task state for ${task.id}: ${(err as Error).message}`,
      );
    }
  }
}
