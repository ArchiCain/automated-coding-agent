import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AgentSlot } from './interfaces/agent-slot.interface';
import { Task } from './interfaces/task.interface';
import { DevTeamConfigService } from '../config/dev-team-config.service';

@Injectable()
export class AgentPoolService {
  private readonly logger = new Logger(AgentPoolService.name);
  private readonly slots: AgentSlot[];

  constructor(
    private readonly configService: DevTeamConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    const maxSlots = this.configService.maxConcurrentAgents;
    this.slots = Array.from({ length: maxSlots }, (_, i) => ({
      id: i,
      status: 'idle' as const,
    }));
    this.logger.log(`Agent pool initialized with ${maxSlots} slots`);
  }

  tryAssign(task: Task): boolean {
    const slot = this.getIdleSlot();
    if (!slot) {
      this.logger.warn(`No idle slots available for task ${task.id}`);
      return false;
    }

    slot.status = 'active';
    slot.taskId = task.id;
    slot.startedAt = new Date();
    task.status = 'assigned';

    this.logger.log(`Assigned task ${task.id} to slot ${slot.id}`);

    // Fire-and-forget: emit event so the orchestrator pipeline can pick it up
    this.eventEmitter.emit('agent.task.assigned', {
      slotId: slot.id,
      taskId: task.id,
      task,
    });

    return true;
  }

  getIdleSlot(): AgentSlot | undefined {
    return this.slots.find((s) => s.status === 'idle');
  }

  getActiveSlots(): AgentSlot[] {
    return this.slots.filter((s) => s.status === 'active');
  }

  getAllSlots(): AgentSlot[] {
    return [...this.slots];
  }

  getSlotStatus(slotId: number): AgentSlot | undefined {
    return this.slots.find((s) => s.id === slotId);
  }

  releaseSlot(slotId: number): void {
    const slot = this.slots.find((s) => s.id === slotId);
    if (slot) {
      this.logger.log(`Releasing slot ${slotId} (was task ${slot.taskId})`);
      slot.status = 'idle';
      slot.taskId = undefined;
      slot.worktreePath = undefined;
      slot.namespace = undefined;
      slot.currentRole = undefined;
      slot.startedAt = undefined;
    }
  }
}
