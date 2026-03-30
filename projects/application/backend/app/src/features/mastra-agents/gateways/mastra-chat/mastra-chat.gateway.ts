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
  ChatChunkEvent,
  ChatCompleteEvent,
  ChatErrorEvent,
  ConversationHistoryEvent,
  SendMessageDto,
  CHAT_EVENTS,
} from './mastra-chat.types';

interface ClientConnectionData {
  userId: string;
  threadId: string;
}

@WebSocketGateway({
  namespace: 'mastra-chat',
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || 'http://localhost:3000',
    credentials: true,
  },
})
export class MastraChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MastraChatGateway.name);
  // Track connection data for each socket
  private readonly connections = new Map<string, ClientConnectionData>();

  constructor(private readonly mastraAgentsService: MastraAgentsService) {}

  async handleConnection(client: Socket) {
    // Socket.IO namespaces: check BOTH query and auth for params
    const userId = (client.handshake.query.userId || client.handshake.auth?.userId) as string;
    const threadId = (client.handshake.query.threadId || client.handshake.auth?.threadId) as string;

    if (!userId || !threadId) {
      this.logger.warn(
        `Client ${client.id} connected without userId or threadId`,
      );
      client.disconnect();
      return;
    }

    this.logger.log(
      `Client ${client.id} connected for user ${userId}, thread ${threadId}`,
    );
    this.connections.set(client.id, { userId, threadId });

    // Load conversation history - will be emitted via event
    await this.mastraAgentsService.getConversationMessages(threadId, client.id);
  }

  handleDisconnect(client: Socket) {
    const connectionData = this.connections.get(client.id);
    if (connectionData) {
      this.logger.log(
        `Client ${client.id} disconnected (user: ${connectionData.userId}, thread: ${connectionData.threadId})`,
      );
      this.connections.delete(client.id);
    }
  }

  /**
   * INPUT: Client sends a message
   */
  @SubscribeMessage('send-message')
  async handleSendMessage(
    @MessageBody() data: SendMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    const connectionData = this.connections.get(client.id);

    if (!connectionData) {
      client.emit('chat-error', {
        error: 'Connection data not found',
      });
      return { success: false, error: 'Connection data not found' };
    }

    if (!data.message) {
      client.emit('chat-error', {
        error: 'message is required',
      });
      return { success: false, error: 'Message is required' };
    }

    this.logger.log(
      `Streaming chat for user ${connectionData.userId}, thread ${connectionData.threadId}`,
    );

    // Call the service - it will emit events that we'll handle below
    // Don't await - let it stream in background, acknowledge immediately
    this.mastraAgentsService.chatStream(data.message, {
      userId: connectionData.userId,
      threadId: connectionData.threadId,
      clientId: client.id,
    }).catch(error => {
      this.logger.error('Chat stream error:', error);
    });

    // Acknowledge message receipt immediately
    return { success: true };
  }

  /**
   * OUTPUT: Send response chunks to client
   */
  @OnEvent(CHAT_EVENTS.CHUNK)
  handleChatChunkEvent(event: ChatChunkEvent) {
    if (!this.server) {
      this.logger.error('WebSocket server not initialized');
      return;
    }

    this.server.to(event.clientId).emit('response-chunk', {
      text: event.text,
      chunkIndex: event.chunkIndex,
    });
  }

  /**
   * OUTPUT: Notify client that streaming is complete
   */
  @OnEvent(CHAT_EVENTS.COMPLETE)
  handleChatCompleteEvent(event: ChatCompleteEvent) {
    if (!this.server) {
      this.logger.error('WebSocket server not initialized');
      return;
    }

    this.server.to(event.clientId).emit('response-complete');
    this.logger.log(`Streaming complete for client ${event.clientId}`);
  }

  /**
   * OUTPUT: Send chat error to client
   */
  @OnEvent(CHAT_EVENTS.ERROR)
  handleChatErrorEvent(event: ChatErrorEvent) {
    if (!this.server) {
      this.logger.error('WebSocket server not initialized');
      return;
    }

    this.server.to(event.clientId).emit('chat-error', {
      error: event.error,
      details: event.details,
    });
    this.logger.error(
      `Chat error for client ${event.clientId}: ${event.error}`,
    );
  }

  /**
   * OUTPUT: Send conversation history to client
   */
  @OnEvent(CHAT_EVENTS.CONVERSATION_HISTORY)
  handleConversationHistoryEvent(event: ConversationHistoryEvent) {
    if (!this.server) {
      this.logger.error('WebSocket server not initialized');
      return;
    }

    this.server.to(event.clientId).emit('conversation-history', {
      messages: event.messages,
    });
    this.logger.log(
      `Conversation history emitted: ${event.messages.length} messages`,
    );
  }
}
