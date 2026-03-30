import { Socket } from 'socket.io-client';
import { ChatHistoryEvent } from '../types';

/**
 * Service for managing conversation list WebSocket operations
 */
export class ConversationListService {
  /**
   * Listen for chat history updates
   */
  onChatHistory(socket: Socket, callback: (event: ChatHistoryEvent) => void): void {
    socket.on('chat-history', callback);
  }

  /**
   * Remove chat history listener
   */
  offChatHistory(socket: Socket, callback: (event: ChatHistoryEvent) => void): void {
    socket.off('chat-history', callback);
  }

  /**
   * Delete a chat/conversation
   */
  async deleteChat(socket: Socket, threadId: string): Promise<void> {
    if (!socket?.connected) {
      throw new Error('WebSocket not connected');
    }
    socket.emit('delete-conversation', { threadId });
  }
}

export const conversationListService = new ConversationListService();
