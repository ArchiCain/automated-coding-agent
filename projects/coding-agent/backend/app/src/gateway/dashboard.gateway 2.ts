import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { Task, GateResultSummary } from '../core/interfaces/task.interface';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/dashboard',
})
export class DashboardGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DashboardGateway.name);

  handleConnection(client: Socket): void {
    this.logger.log(`Dashboard client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Dashboard client disconnected: ${client.id}`);
  }

  emitAgentProgress(
    taskId: string,
    role: string,
    message: string,
  ): void {
    this.server.emit('agent:progress', { taskId, role, message });
  }

  emitTaskUpdate(task: Task): void {
    this.server.emit('task:update', task);
  }

  emitEnvironmentHealth(
    taskId: string,
    health: { healthy: boolean; services: Record<string, unknown> },
  ): void {
    this.server.emit('environment:health', { taskId, ...health });
  }

  emitGateResult(taskId: string, result: GateResultSummary): void {
    this.server.emit('gate:result', { taskId, ...result });
  }
}
