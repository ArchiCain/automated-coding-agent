import { Socket } from 'socket.io-client';

/**
 * Service for managing message input WebSocket operations
 */
export class MessageInputService {
  /**
   * Send a message via WebSocket
   */
  async sendMessage(socket: Socket, message: string): Promise<void> {
    return new Promise((resolve, reject) => {
      socket.emit('send-message', { message }, (error: Error | null) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
}

export const messageInputService = new MessageInputService();
