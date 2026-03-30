/**
 * Unit test for MastraAgentsService
 * Tests business logic with mocked dependencies
 */

import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MastraAgentsService } from './mastra-agents.service';
import { MastraService } from './mastra.service';
import { CHAT_EVENTS } from './gateways/mastra-chat/mastra-chat.types';
import { CHAT_HISTORY_EVENTS } from './gateways/mastra-chat-history/mastra-chat-history.types';

describe('MastraAgentsService (Unit)', () => {
  let service: MastraAgentsService;
  let mockMastraService: any;
  let mockEventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    // Create mock Mastra service
    mockMastraService = {
      mastra: {
        getAgent: jest.fn(),
        getStorage: jest.fn(),
      },
    };

    // Create mock event emitter
    mockEventEmitter = {
      emit: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MastraAgentsService,
        { provide: MastraService, useValue: mockMastraService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<MastraAgentsService>(MastraAgentsService);
  });

  describe('chat', () => {
    it('should call agent.generate with correct parameters', async () => {
      // Arrange
      const mockAgent = {
        generate: jest.fn().mockResolvedValue('AI response'),
      };
      mockMastraService.mastra.getAgent.mockReturnValue(mockAgent);

      // Act
      const result = await service.chat('Hello AI', {
        userId: 'user-1',
        threadId: 'thread-1',
      });

      // Assert
      expect(mockMastraService.mastra.getAgent).toHaveBeenCalledWith('chat-agent');
      expect(mockAgent.generate).toHaveBeenCalledWith('Hello AI', {
        resourceId: 'user-1',
        threadId: 'thread-1',
      });
      expect(result).toBe('AI response');
    });

    it('should throw error when userId is missing', async () => {
      // Act & Assert
      await expect(
        service.chat('Hello', { userId: null, threadId: 'thread-1' } as any)
      ).rejects.toThrow('Both userId and threadId are required');
    });

    it('should throw error when threadId is missing', async () => {
      // Act & Assert
      await expect(
        service.chat('Hello', { userId: 'user-1', threadId: null } as any)
      ).rejects.toThrow('Both userId and threadId are required');
    });
  });

  describe('chatStream', () => {
    it('should emit chunk events during streaming', async () => {
      // Arrange
      const mockAgent = {
        stream: jest.fn().mockResolvedValue({
          textStream: (async function* () {
            yield 'chunk1';
            yield 'chunk2';
            yield 'chunk3';
          })(),
        }),
      };
      mockMastraService.mastra.getAgent.mockReturnValue(mockAgent);

      // Act
      await service.chatStream('Hello AI', {
        userId: 'user-1',
        threadId: 'thread-1',
        clientId: 'client-1',
      });

      // Assert
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        CHAT_EVENTS.CHUNK,
        expect.objectContaining({
          clientId: 'client-1',
          text: 'chunk1',
          chunkIndex: 0,
        })
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        CHAT_EVENTS.CHUNK,
        expect.objectContaining({
          clientId: 'client-1',
          text: 'chunk2',
          chunkIndex: 1,
        })
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        CHAT_EVENTS.CHUNK,
        expect.objectContaining({
          clientId: 'client-1',
          text: 'chunk3',
          chunkIndex: 2,
        })
      );
    });

    it('should emit complete event after streaming finishes', async () => {
      // Arrange
      const mockAgent = {
        stream: jest.fn().mockResolvedValue({
          textStream: (async function* () {
            yield 'chunk1';
          })(),
        }),
      };
      mockMastraService.mastra.getAgent.mockReturnValue(mockAgent);

      // Act
      await service.chatStream('Hello', {
        userId: 'user-1',
        threadId: 'thread-1',
        clientId: 'client-1',
      });

      // Assert
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        CHAT_EVENTS.COMPLETE,
        expect.objectContaining({
          clientId: 'client-1',
        })
      );
    });

    it('should emit conversation update event after streaming', async () => {
      // Arrange
      const mockAgent = {
        stream: jest.fn().mockResolvedValue({
          textStream: (async function* () {
            yield 'chunk1';
          })(),
        }),
      };
      mockMastraService.mastra.getAgent.mockReturnValue(mockAgent);

      // Act
      await service.chatStream('Hello', {
        userId: 'user-1',
        threadId: 'thread-1',
        clientId: 'client-1',
      });

      // Assert
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        CHAT_HISTORY_EVENTS.CONVERSATION_UPDATE,
        expect.objectContaining({
          userId: 'user-1',
        })
      );
    });

    it('should emit error event on streaming failure', async () => {
      // Arrange
      const mockAgent = {
        stream: jest.fn().mockRejectedValue(new Error('Stream failed')),
      };
      mockMastraService.mastra.getAgent.mockReturnValue(mockAgent);

      // Act
      await service.chatStream('Hello', {
        userId: 'user-1',
        threadId: 'thread-1',
        clientId: 'client-1',
      });

      // Assert
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        CHAT_EVENTS.ERROR,
        expect.objectContaining({
          clientId: 'client-1',
          error: 'Failed to process chat stream',
        })
      );
    });
  });

  describe('getConversations', () => {
    it('should retrieve and emit conversation list', async () => {
      // Arrange
      const mockThreads = [
        { id: 'thread-1', title: 'Conversation 1', updatedAt: new Date() },
        { id: 'thread-2', title: 'Conversation 2', updatedAt: new Date() },
      ];

      mockMastraService.mastra.getStorage.mockReturnValue({
        getThreadsByResourceIdPaginated: jest.fn().mockResolvedValue({
          threads: mockThreads,
        }),
      });

      // Act
      const result = await service.getConversations('user-1', 'client-1');

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        threadId: 'thread-1',
        title: 'Conversation 1',
      });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        CHAT_HISTORY_EVENTS.CHAT_HISTORY,
        expect.objectContaining({
          clientId: 'client-1',
          conversations: expect.arrayContaining([
            expect.objectContaining({ threadId: 'thread-1' }),
          ]),
        })
      );
    });

    it('should throw error when userId is missing', async () => {
      // Act & Assert
      await expect(
        service.getConversations(null as any, 'client-1')
      ).rejects.toThrow('userId is required');
    });
  });

  describe('getConversationMessages', () => {
    it('should retrieve and transform messages', async () => {
      // Arrange
      const mockMessages = [
        {
          id: 'msg-1',
          role: 'user',
          content: { content: 'Hello' },
          createdAt: new Date('2025-01-01'),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: { content: 'Hi there' },
          createdAt: new Date('2025-01-02'),
        },
        {
          id: 'msg-3',
          role: 'system',
          content: { content: 'System message' },
          createdAt: new Date('2025-01-03'),
        },
      ];

      mockMastraService.mastra.getStorage.mockReturnValue({
        getMessages: jest.fn().mockResolvedValue(mockMessages),
      });

      // Act
      const result = await service.getConversationMessages('thread-1', 'client-1');

      // Assert
      expect(result).toHaveLength(2); // System message filtered out
      expect(result[0]).toMatchObject({
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
      });
      expect(result[1]).toMatchObject({
        id: 'msg-2',
        role: 'assistant',
        content: 'Hi there',
      });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        CHAT_EVENTS.CONVERSATION_HISTORY,
        expect.objectContaining({
          clientId: 'client-1',
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'user' }),
          ]),
        })
      );
    });

    it('should throw error when threadId is missing', async () => {
      // Act & Assert
      await expect(
        service.getConversationMessages(null as any, 'client-1')
      ).rejects.toThrow('threadId is required');
    });

    it('should filter out system messages', async () => {
      // Arrange
      const mockMessages = [
        {
          id: 'msg-1',
          role: 'system',
          content: { content: 'System' },
          createdAt: new Date(),
        },
      ];

      mockMastraService.mastra.getStorage.mockReturnValue({
        getMessages: jest.fn().mockResolvedValue(mockMessages),
      });

      // Act
      const result = await service.getConversationMessages('thread-1', 'client-1');

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  describe('deleteConversation', () => {
    it('should delete thread and emit update event', async () => {
      // Arrange
      mockMastraService.mastra.getStorage.mockReturnValue({
        deleteThread: jest.fn().mockResolvedValue(undefined),
      });

      // Act
      const result = await service.deleteConversation('thread-1', 'user-1');

      // Assert
      expect(result).toBe(true);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        CHAT_HISTORY_EVENTS.CONVERSATION_UPDATE,
        expect.objectContaining({
          userId: 'user-1',
        })
      );
    });

    it('should throw error when threadId is missing', async () => {
      // Act & Assert
      await expect(
        service.deleteConversation(null as any)
      ).rejects.toThrow('threadId is required');
    });

    it('should not emit update event when userId not provided', async () => {
      // Arrange
      mockMastraService.mastra.getStorage.mockReturnValue({
        deleteThread: jest.fn().mockResolvedValue(undefined),
      });

      // Act
      await service.deleteConversation('thread-1');

      // Assert
      expect(mockEventEmitter.emit).not.toHaveBeenCalledWith(
        CHAT_HISTORY_EVENTS.CONVERSATION_UPDATE,
        expect.anything()
      );
    });
  });
});
