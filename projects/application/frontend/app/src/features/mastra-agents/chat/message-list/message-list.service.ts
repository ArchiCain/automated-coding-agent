import { Socket } from 'socket.io-client';
import { Message, ConversationHistoryEvent, ResponseChunkEvent } from '../types';
import { MastraChatService } from '../chat.service';

/**
 * Service for managing message list WebSocket operations
 */
export class MessageListService {
  /**
   * Listen for conversation history
   */
  onConversationHistory(socket: Socket, callback: (event: ConversationHistoryEvent) => void): void {
    socket.on('conversation-history', callback);
  }

  /**
   * Listen for response chunks (for streaming messages)
   */
  onResponseChunk(socket: Socket, callback: (event: ResponseChunkEvent) => void): void {
    socket.on('response-chunk', callback);
  }

  /**
   * Listen for chat errors
   */
  onChatError(socket: Socket, callback: (event: { error: string; details?: string }) => void): void {
    socket.on('chat-error', callback);
  }

  /**
   * Remove conversation history listener
   */
  offConversationHistory(socket: Socket, callback: (event: ConversationHistoryEvent) => void): void {
    socket.off('conversation-history', callback);
  }

  /**
   * Remove response chunk listener
   */
  offResponseChunk(socket: Socket, callback: (event: ResponseChunkEvent) => void): void {
    socket.off('response-chunk', callback);
  }

  /**
   * Remove chat error listener
   */
  offChatError(socket: Socket, callback: (event: { error: string; details?: string }) => void): void {
    socket.off('chat-error', callback);
  }

  /**
   * Create a user message object
   */
  createUserMessage(content: string): Message {
    return {
      id: MastraChatService.generateMessageId(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
  }

  /**
   * Create an assistant message object
   */
  createAssistantMessage(content: string, isStreaming = false): Message {
    return {
      id: MastraChatService.generateMessageId(),
      role: 'assistant',
      content,
      timestamp: new Date(),
      isStreaming,
    };
  }
}

export const messageListService = new MessageListService();
