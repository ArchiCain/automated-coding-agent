import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EnvironmentService } from '../services/environment.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/environment',
})
export class EnvironmentGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EnvironmentGateway.name);

  constructor(private readonly environmentService: EnvironmentService) {}

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Clean up any streams this client was subscribed to
    const rooms = Array.from(client.rooms);
    for (const room of rooms) {
      if (room.startsWith('logs:')) {
        const streamKey = room.replace('logs:', '');
        // Check if anyone else is still in this room
        const roomMembers = this.server.adapter['rooms']?.get(room);
        if (!roomMembers || roomMembers.size === 0) {
          this.environmentService.stopLogStream(streamKey);
        }
      }
    }
  }

  @SubscribeMessage('subscribe:logs')
  async handleSubscribeLogs(
    client: Socket,
    data: { planId: string; service?: string },
  ): Promise<void> {
    const { planId, service } = data;
    this.logger.log(
      `Client ${client.id} subscribing to logs: ${planId}/${service || 'all'}`,
    );

    try {
      const streamKey = await this.environmentService.startLogStream(
        planId,
        service,
      );
      client.join(`logs:${streamKey}`);
      client.emit('logs:subscribed', { streamKey });
    } catch (err) {
      client.emit('logs:error', {
        message: err.message || 'Failed to start log stream',
      });
    }
  }

  @SubscribeMessage('unsubscribe:logs')
  handleUnsubscribeLogs(client: Socket, data: { streamKey: string }): void {
    const { streamKey } = data;
    this.logger.log(
      `Client ${client.id} unsubscribing from logs: ${streamKey}`,
    );
    client.leave(`logs:${streamKey}`);

    // If no one else is listening, stop the stream
    const room = this.server.adapter['rooms']?.get(`logs:${streamKey}`);
    if (!room || room.size === 0) {
      this.environmentService.stopLogStream(streamKey);
    }
  }

  @OnEvent('env:logs:line')
  handleLogLine(payload: { streamKey: string; line: string }): void {
    this.server
      .to(`logs:${payload.streamKey}`)
      .emit('logs:line', { line: payload.line });
  }

  @OnEvent('env:logs:end')
  handleLogEnd(payload: { streamKey: string; code: number }): void {
    this.server
      .to(`logs:${payload.streamKey}`)
      .emit('logs:end', { code: payload.code });
  }
}
