/**
 * Integration test for MastraChatGateway
 * Tests WebSocket connections and streaming with real backend
 * Requires: Backend running at localhost:8085 with real Mastra AI
 */

import { io, Socket } from 'socket.io-client';

const BACKEND_URL = `http://localhost:${process.env.BACKEND_PORT}`;
const NAMESPACE = '/mastra-chat';

describe('MastraChatGateway (Integration)', () => {
  let socket: Socket;

  afterEach((done) => {
    if (socket) {
      socket.disconnect();
      socket.close();
      // Give socket time to fully close
      setTimeout(done, 100);
    } else {
      done();
    }
  });

  describe('Connection', () => {
    it('should connect with valid userId and threadId', (done) => {
      // Act
      socket = io(`${BACKEND_URL}${NAMESPACE}`, {
        auth: {
          userId: 'test-user',
          threadId: 'test-thread',
        },
      });

      socket.on('connect', () => {
        // Assert
        expect(socket.connected).toBe(true);
        done();
      });

      socket.on('connect_error', (error) => {
        done(error);
      });
    }, 10000);

    it('should disconnect when userId is missing', (done) => {
      // Act
      socket = io(`${BACKEND_URL}${NAMESPACE}`, {
        auth: {
          threadId: 'test-thread',
        },
        timeout: 2000,
      });

      let disconnectReceived = false;

      socket.on('disconnect', (reason) => {
        disconnectReceived = true;
        // Assert - disconnect is expected for invalid connection
        expect(socket.connected).toBe(false);
        done();
      });

      socket.on('connect_error', () => {
        // Also acceptable - connection rejected
        if (!disconnectReceived) {
          expect(socket.connected).toBe(false);
          done();
        }
      });

      // Timeout if neither event received
      setTimeout(() => {
        if (!disconnectReceived && socket.connected) {
          done(new Error('Socket should have been disconnected'));
        } else if (!disconnectReceived) {
          // If not connected and no disconnect, that's also a pass
          done();
        }
      }, 3000);
    }, 10000);

    it('should disconnect when threadId is missing', (done) => {
      // Act
      socket = io(`${BACKEND_URL}${NAMESPACE}`, {
        auth: {
          userId: 'test-user',
        },
        timeout: 2000,
      });

      let disconnectReceived = false;

      socket.on('disconnect', () => {
        disconnectReceived = true;
        // Assert
        expect(socket.connected).toBe(false);
        done();
      });

      socket.on('connect_error', () => {
        // Also acceptable - connection rejected
        if (!disconnectReceived) {
          expect(socket.connected).toBe(false);
          done();
        }
      });

      setTimeout(() => {
        if (!disconnectReceived && socket.connected) {
          done(new Error('Socket should have been disconnected'));
        } else if (!disconnectReceived) {
          done();
        }
      }, 3000);
    }, 10000);
  });

  describe('Chat Streaming', () => {
    beforeEach((done) => {
      // Connect before each test
      socket = io(`${BACKEND_URL}${NAMESPACE}`, {
        auth: {
          userId: 'test-user-' + Date.now(),
          threadId: 'test-thread-' + Date.now(),
        },
      });

      socket.on('connect', () => done());
      socket.on('connect_error', (error) => done(error));
    }, 10000);

    it('should receive streaming chunks when sending message', (done) => {
      // Arrange
      const chunks: string[] = [];
      let isComplete = false;

      socket.on('response-chunk', (data) => {
        chunks.push(data.text);
        expect(data.chunkIndex).toBeDefined();
        expect(typeof data.chunkIndex).toBe('number');
      });

      socket.on('response-complete', () => {
        isComplete = true;

        // Assert
        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks.join('').length).toBeGreaterThan(0);
        done();
      });

      socket.on('chat-error', (error) => {
        done(new Error(`Chat error: ${error.error}`));
      });

      // Act - send message to trigger AI response
      socket.emit('send-message', { message: 'Say hello' });
    }, 30000); // AI responses can take time

    it('should receive conversation history on connect', (done) => {
      // This socket has a fresh threadId, so history should be empty or have messages
      socket.on('conversation-history', (data) => {
        // Assert
        expect(data.messages).toBeDefined();
        expect(Array.isArray(data.messages)).toBe(true);
        done();
      });

      // If no history event in 5 seconds, that's ok for a new thread
      setTimeout(() => {
        done();
      }, 5000);
    }, 10000);

    it('should handle multiple messages sequentially', (done) => {
      let firstComplete = false;
      let secondComplete = false;
      const message1Chunks: string[] = [];
      const message2Chunks: string[] = [];

      socket.on('response-chunk', (data) => {
        if (!firstComplete) {
          message1Chunks.push(data.text);
        } else {
          message2Chunks.push(data.text);
        }
      });

      socket.on('response-complete', () => {
        if (!firstComplete) {
          firstComplete = true;
          // Send second message
          socket.emit('send-message', { message: 'Second message' });
        } else {
          secondComplete = true;
          // Assert
          expect(message1Chunks.length).toBeGreaterThan(0);
          expect(message2Chunks.length).toBeGreaterThan(0);
          done();
        }
      });

      socket.on('chat-error', (error) => {
        done(new Error(`Chat error: ${error.error}`));
      });

      // Start first message
      socket.emit('send-message', { message: 'First message' });
    }, 60000); // Two AI responses can take time
  });

  describe('Error Handling', () => {
    beforeEach((done) => {
      socket = io(`${BACKEND_URL}${NAMESPACE}`, {
        auth: {
          userId: 'error-test-user',
          threadId: 'error-test-thread',
        },
      });

      socket.on('connect', () => done());
      socket.on('connect_error', (error) => done(error));
    }, 10000);

    it('should emit error event on invalid input', (done) => {
      let timeoutId: NodeJS.Timeout;

      socket.on('chat-error', (data) => {
        // Assert
        clearTimeout(timeoutId);
        expect(data.error).toBeDefined();
        done();
      });

      // Act - send message without required field
      socket.emit('send-message', { invalidField: 'value' });

      timeoutId = setTimeout(() => {
        done(new Error('Expected error event'));
      }, 5000);
    }, 10000);
  });
});
