import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import { TaskRunnerService } from './task-runner.service';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/task-runner' })
export class TaskRunnerGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TaskRunnerGateway.name);

  constructor(private readonly taskRunnerService: TaskRunnerService) {}

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { taskId: string },
  ) {
    this.logger.log(`Client subscribing to task ${data.taskId}`);
    client.join(`task:${data.taskId}`);

    // Send buffered output so far
    try {
      const output = this.taskRunnerService.getOutput(data.taskId);
      for (const line of output) {
        client.emit('task:output', {
          taskId: data.taskId,
          line,
          stream: 'stdout',
        });
      }
    } catch {
      // Task may not exist yet, that's fine
    }
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { taskId: string },
  ) {
    this.logger.log(`Client unsubscribing from task ${data.taskId}`);
    client.leave(`task:${data.taskId}`);
  }

  @SubscribeMessage('cancel')
  handleCancel(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { taskId: string },
  ) {
    this.logger.log(`Cancel requested for task ${data.taskId}`);
    try {
      this.taskRunnerService.cancelTask(data.taskId);
      client.emit('task:status', {
        taskId: data.taskId,
        status: 'cancelled',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      client.emit('task:error', { taskId: data.taskId, error: msg });
    }
  }

  @OnEvent('task-runner.output')
  handleTaskOutput(payload: { taskId: string; line: string; stream: string }) {
    this.server?.to(`task:${payload.taskId}`).emit('task:output', payload);
  }

  @OnEvent('task-runner.status')
  handleTaskStatus(payload: { taskId: string; status: string; exitCode?: number }) {
    // Broadcast status changes to all connected clients
    this.server?.emit('task:status', payload);
  }
}
