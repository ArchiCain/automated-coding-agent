import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MastraAgentsService } from '../../services/mastra-agents.service';
import {
  ChatHistoryEvent,
  ConversationUpdateEvent,
  DeleteConversationDto,
  CHAT_HISTORY_EVENTS,
} from './mastra-chat-history.types';

interface ClientConnectionData {
  userId: string;
}

@WebSocketGateway({
  namespace: 'mastra-chat-history',
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || 'http://localhost:3000',
    credentials: true,
  },
})
export class MastraChatHistoryGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MastraChatHistoryGateway.name);
  // Track connection data for each socket
  private readonly connections = new Map<string, ClientConnectionData>();
  // Track which clients belong to which user
  private readonly userClients = new Map<string, Set<string>>();

  constructor(private readonly mastraAgentsService: MastraAgentsService) {}

  async handleConnection(client: Socket) {
    // Socket.IO namespaces: check BOTH query and auth for params
    const userId = (client.handshake.query.userId || client.handshake.auth?.userId) as string;

    if (!userId) {
      this.logger.warn(`Client ${client.id} connected without userId`);
      client.disconnect();
      return;
    }

    this.logger.log(`Client ${client.id} connected for user ${userId}`);
    this.connections.set(client.id, { userId });

    // Track user's clients
    if (!this.userClients.has(userId)) {
      this.userClients.set(userId, new Set());
    }
    this.userClients.get(userId)!.add(client.id);

    // Load conversation list - will be emitted via event
    await this.mastraAgentsService.getConversations(userId, client.id, 'initial');
  }

  handleDisconnect(client: Socket) {
    const connectionData = this.connections.get(client.id);
    if (connectionData) {
      this.logger.log(
        `Client ${client.id} disconnected (user: ${connectionData.userId})`,
      );

      // Remove from user's clients
      const userId = connectionData.userId;
      const clients = this.userClients.get(userId);
      if (clients) {
        clients.delete(client.id);
        if (clients.size === 0) {
          this.userClients.delete(userId);
        }
      }

      this.connections.delete(client.id);
    }
  }

  /**
   * INPUT: Client requests to delete a conversation
   */
  @SubscribeMessage('delete-conversation')
  async handleDeleteConversation(
    @MessageBody() data: DeleteConversationDto,
    @ConnectedSocket() client: Socket,
  ) {
    const connectionData = this.connections.get(client.id);

    if (!connectionData) {
      client.emit('chat-error', {
        error: 'Connection data not found',
      });
      return;
    }

    if (!data.threadId) {
      client.emit('chat-error', {
        error: 'threadId is required',
      });
      return;
    }

    this.logger.log(
      `Deleting conversation ${data.threadId} for user ${connectionData.userId}`,
    );

    try {
      await this.mastraAgentsService.deleteConversation(
        data.threadId,
        connectionData.userId,
      );
      // Service will emit CONVERSATION_UPDATE event which triggers refresh
    } catch (error) {
      client.emit('chat-error', {
        error: 'Failed to delete conversation',
        details: error.message,
      });
    }
  }

  /**
   * OUTPUT: Send conversation list to client
   */
  @OnEvent(CHAT_HISTORY_EVENTS.CHAT_HISTORY)
  handleChatHistoryEvent(event: ChatHistoryEvent) {
    if (!this.server) {
      this.logger.error('WebSocket server not initialized');
      return;
    }

    this.server.to(event.clientId).emit('chat-history', {
      conversations: event.conversations,
      type: event.type,
    });

    this.logger.log(
      `Chat history emitted to ${event.clientId}: ${event.conversations.length} conversations (${event.type})`,
    );
  }

  /**
   * OUTPUT: Refresh conversation list for all user's clients
   */
  @OnEvent(CHAT_HISTORY_EVENTS.CONVERSATION_UPDATE)
  async handleConversationUpdateEvent(event: ConversationUpdateEvent) {
    const clientIds = this.userClients.get(event.userId);
    if (!clientIds || clientIds.size === 0) {
      return;
    }

    this.logger.log(
      `Refreshing conversations for user ${event.userId} (${clientIds.size} clients)`,
    );

    // Fetch updated conversations and emit to all user's clients
    for (const clientId of clientIds) {
      await this.mastraAgentsService.getConversations(
        event.userId,
        clientId,
        'update',
      );
    }
  }
}
