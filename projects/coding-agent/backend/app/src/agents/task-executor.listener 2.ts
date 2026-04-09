import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ExecutionLoopService } from './execution-loop.service';
import { AgentPoolService } from '../core/agent-pool.service';
import { Task } from '../core/interfaces/task.interface';
import { DashboardGateway } from '../gateway/dashboard.gateway';

@Injectable()
export class TaskExecutorListener {
  private readonly logger = new Logger(TaskExecutorListener.name);

  constructor(
    private readonly executionLoop: ExecutionLoopService,
    private readonly agentPool: AgentPoolService,
    private readonly dashboardGateway: DashboardGateway,
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

      // Notify dashboard of completion
      task.status = result.status === 'completed' ? 'completed' : 'failed';
      this.dashboardGateway.emitTaskUpdate(task);
    } catch (err) {
      this.logger.error(
        `Task ${task.id} threw unexpectedly: ${(err as Error).message}`,
        (err as Error).stack,
      );
      task.status = 'failed';
      this.dashboardGateway.emitTaskUpdate(task);
    } finally {
      // Always release the slot
      this.agentPool.releaseSlot(slotId);
    }
  }
}
