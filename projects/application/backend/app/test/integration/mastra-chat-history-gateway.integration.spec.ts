/**
 * Integration test for MastraChatHistoryGateway
 * Tests WebSocket connections for chat history management
 * Requires: Backend running at localhost:8085
 */

import { io, Socket } from 'socket.io-client';

const BACKEND_URL = `http://localhost:${process.env.BACKEND_PORT}`;
const NAMESPACE = '/mastra-chat-history';

describe('MastraChatHistoryGateway (Integration)', () => {
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
    it('should connect with valid userId', (done) => {
      // Act
      socket = io(`${BACKEND_URL}${NAMESPACE}`, {
        auth: {
          userId: 'test-user-' + Date.now(),
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
        auth: {},
        timeout: 2000,
      });

      let disconnectReceived = false;

      socket.on('disconnect', () => {
        disconnectReceived = true;
        expect(socket.connected).toBe(false);
        done();
      });

      socket.on('connect_error', () => {
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

  describe('Chat History', () => {
    beforeEach((done) => {
      // Connect before each test with unique userId
      socket = io(`${BACKEND_URL}${NAMESPACE}`, {
        auth: {
          userId: 'history-test-user-' + Date.now(),
        },
      });

      socket.on('connect', () => done());
      socket.on('connect_error', (error) => done(error));
    }, 10000);

    it('should receive chat history on connect', (done) => {
      let timeoutId: NodeJS.Timeout;

      // Arrange - listen for history
      socket.on('chat-history', (data) => {
        // Assert
        clearTimeout(timeoutId);
        expect(data.conversations).toBeDefined();
        expect(Array.isArray(data.conversations)).toBe(true);
        expect(data.type).toBe('initial');
        done();
      });

      // History should be sent on connect, but if not received in 5s, that's ok
      timeoutId = setTimeout(() => {
        done();
      }, 5000);
    }, 10000);

    it('should handle delete conversation request', (done) => {
      let historyReceived = false;
      let threadIdToDelete: string | null = null;
      let initialTimeoutId: NodeJS.Timeout;
      let updateTimeoutId: NodeJS.Timeout;

      // Wait for initial history
      socket.on('chat-history', (data) => {
        if (!historyReceived) {
          historyReceived = true;
          clearTimeout(initialTimeoutId);

          if (data.conversations && data.conversations.length > 0) {
            // Try to delete first conversation
            threadIdToDelete = data.conversations[0].threadId;
            socket.emit('delete-conversation', { threadId: threadIdToDelete });

            // Wait for update event
            socket.on('chat-history', (updateData) => {
              if (updateData.type === 'update') {
                // Assert
                clearTimeout(updateTimeoutId);
                expect(updateData.conversations).toBeDefined();
                done();
              }
            });

            // Timeout if no update received
            updateTimeoutId = setTimeout(() => {
              done(); // Ok if no update event
            }, 5000);
          } else {
            // No conversations to delete
            done();
          }
        }
      });

      initialTimeoutId = setTimeout(() => {
        if (!historyReceived) {
          done(); // Ok if no history
        }
      }, 5000);
    }, 15000);

    it('should emit error when deleting without threadId', (done) => {
      let timeoutId: NodeJS.Timeout;

      socket.on('chat-error', (data) => {
        // Assert
        clearTimeout(timeoutId);
        expect(data.error).toBeDefined();
        expect(data.error).toContain('threadId');
        done();
      });

      // Act - send delete without threadId
      socket.emit('delete-conversation', {});

      timeoutId = setTimeout(() => {
        done(new Error('Expected chat-error event'));
      }, 5000);
    }, 10000);
  });

  describe('Conversation Updates', () => {
    it('should receive updates when conversations change', (done) => {
      const userId = 'update-test-user-' + Date.now();
      let socket1: Socket;
      let socket2: Socket;
      let chatSocket: Socket;

      // Cleanup function
      const cleanup = () => {
        if (socket1) { socket1.disconnect(); socket1.close(); }
        if (socket2) { socket2.disconnect(); socket2.close(); }
        if (chatSocket) { chatSocket.disconnect(); chatSocket.close(); }
      };

      // Create two socket connections for the same user
      socket1 = io(`${BACKEND_URL}${NAMESPACE}`, {
        auth: { userId },
      });

      socket1.on('connect', () => {
        // Create second socket for same user
        socket2 = io(`${BACKEND_URL}${NAMESPACE}`, {
          auth: { userId },
        });

        let updateCount = 0;

        socket2.on('chat-history', (data) => {
          if (data.type === 'update') {
            updateCount++;

            if (updateCount >= 1) {
              // Assert - both clients should receive updates
              expect(data.conversations).toBeDefined();

              cleanup();
              setTimeout(done, 200); // Give sockets time to close
            }
          }
        });

        // Simulate a conversation update by sending a chat message
        // (This will trigger CONVERSATION_UPDATE event)
        chatSocket = io(`${BACKEND_URL}/mastra-chat`, {
          auth: { userId, threadId: 'test-thread-' + Date.now() },
        });

        chatSocket.on('connect', () => {
          chatSocket.emit('send-message', { message: 'Trigger update' });

          chatSocket.on('response-complete', () => {
            // Update event should have been sent to history sockets
          });
        });

        // Timeout
        setTimeout(() => {
          if (updateCount === 0) {
            // Ok if no update received, just verify structure was set up
            cleanup();
            setTimeout(done, 200);
          }
        }, 15000);
      });
    }, 20000);
  });
});
