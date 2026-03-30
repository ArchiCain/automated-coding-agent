import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';
import { TaskService } from '../services/task.service';
import { TaskDefinition, TaskExecution, RunTaskDto } from '../models/task.model';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/tasks',
})
export class TaskGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(TaskGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly taskService: TaskService) {}

  handleConnection(client: Socket): void {
    this.logger.debug(`Client connected to tasks: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Client disconnected from tasks: ${client.id}`);
  }

  /**
   * List all available tasks
   */
  @SubscribeMessage('task:list')
  async handleList(): Promise<TaskDefinition[]> {
    try {
      return await this.taskService.listTasks();
    } catch (error) {
      this.logger.error('Failed to list tasks', error);
      return [];
    }
  }

  /**
   * Run a task
   */
  @SubscribeMessage('task:run')
  async handleRun(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: RunTaskDto
  ): Promise<{ id: string }> {
    const execution = await this.taskService.create(payload.task, payload.args);

    // Subscribe client to this execution's room
    client.join(`task:${execution.id}`);

    // Fire and forget - execute asynchronously
    this.taskService.execute(execution.id).catch((error) => {
      this.logger.error(`Failed to execute task ${execution.id}`, error);
    });

    return { id: execution.id };
  }

  /**
   * Stop a running task (SIGTERM)
   */
  @SubscribeMessage('task:stop')
  async handleStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() executionId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.taskService.stop(executionId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Kill a running task (SIGKILL)
   */
  @SubscribeMessage('task:kill')
  async handleKill(
    @ConnectedSocket() client: Socket,
    @MessageBody() executionId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.taskService.kill(executionId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Subscribe to an execution's updates (for reconnection)
   */
  @SubscribeMessage('task:subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() executionId: string
  ): Promise<TaskExecution | null> {
    client.join(`task:${executionId}`);
    this.logger.debug(`Client ${client.id} subscribed to execution ${executionId}`);

    const execution = this.taskService.get(executionId);
    return execution || null;
  }

  /**
   * Unsubscribe from an execution's updates
   */
  @SubscribeMessage('task:unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() executionId: string
  ): void {
    client.leave(`task:${executionId}`);
    this.logger.debug(`Client ${client.id} unsubscribed from execution ${executionId}`);
  }

  /**
   * Dismiss (delete) an execution
   */
  @SubscribeMessage('task:dismiss')
  async handleDismiss(
    @ConnectedSocket() client: Socket,
    @MessageBody() executionId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.taskService.dismiss(executionId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all executions
   */
  @SubscribeMessage('task:executions')
  handleGetExecutions(): TaskExecution[] {
    return this.taskService.getAll();
  }

  // Event handlers - broadcast to clients

  @OnEvent('task:started')
  handleTaskStarted(payload: { execution: TaskExecution }): void {
    this.server.emit('task:started', payload);
    this.server.to(`task:${payload.execution.id}`).emit('task:started', payload);
  }

  @OnEvent('task:output')
  handleTaskOutput(payload: { executionId: string; line: string }): void {
    // Only send to subscribers of this specific execution to avoid flooding
    this.server.to(`task:${payload.executionId}`).emit('task:output', payload);
  }

  @OnEvent('task:completed')
  handleTaskCompleted(payload: { execution: TaskExecution }): void {
    this.server.emit('task:completed', payload);
    this.server.to(`task:${payload.execution.id}`).emit('task:completed', payload);
  }

  @OnEvent('task:failed')
  handleTaskFailed(payload: { execution: TaskExecution; error: string }): void {
    this.server.emit('task:failed', payload);
    this.server.to(`task:${payload.execution.id}`).emit('task:failed', payload);
  }

  @OnEvent('task:cancelled')
  handleTaskCancelled(payload: { execution: TaskExecution }): void {
    this.server.emit('task:cancelled', payload);
    this.server.to(`task:${payload.execution.id}`).emit('task:cancelled', payload);
  }

  @OnEvent('task:dismissed')
  handleTaskDismissed(payload: { executionId: string }): void {
    this.server.emit('task:dismissed', payload);
  }
}
