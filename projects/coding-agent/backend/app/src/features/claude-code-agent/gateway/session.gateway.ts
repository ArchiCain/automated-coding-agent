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

/**
 * Minimal WebSocket gateway for session events.
 * Broadcasts session completion events to subscribed clients.
 */
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/sessions',
})
export class SessionGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SessionGateway.name);

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket, sessionId: string): void {
    client.join(`session:${sessionId}`);
    this.logger.log(`Client ${client.id} subscribed to session ${sessionId}`);
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(client: Socket, sessionId: string): void {
    client.leave(`session:${sessionId}`);
    this.logger.log(`Client ${client.id} unsubscribed from session ${sessionId}`);
  }

  // Listen for session events from SessionService and broadcast to clients
  @OnEvent('session:started')
  handleSessionStarted(payload: { session: unknown }): void {
    this.server.emit('session:started', payload);
  }

  @OnEvent('session:completed')
  handleSessionCompleted(payload: { session: unknown }): void {
    this.server.emit('session:completed', payload);
    // Also emit to the specific session room
    const session = payload.session as { sessionId?: string };
    if (session?.sessionId) {
      this.server.to(`session:${session.sessionId}`).emit('session:completed', payload);
    }
  }

  @OnEvent('session:error')
  handleSessionError(payload: { sessionId: string; error: string }): void {
    this.server.to(`session:${payload.sessionId}`).emit('session:error', payload);
  }

  @OnEvent('session:output')
  handleSessionOutput(payload: { sessionId: string; line: string }): void {
    this.server.to(`session:${payload.sessionId}`).emit('session:output', payload);
  }

  @OnEvent('session:turn_complete')
  handleSessionTurnComplete(payload: { sessionId: string; timestamp: string }): void {
    this.server.to(`session:${payload.sessionId}`).emit('session:turn_complete', payload);
  }

  @OnEvent('session:paused')
  handleSessionPaused(payload: { sessionId: string }): void {
    this.server.to(`session:${payload.sessionId}`).emit('session:paused', payload);
  }
}
