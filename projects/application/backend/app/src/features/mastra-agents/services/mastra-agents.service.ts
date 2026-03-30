import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MastraService } from "./mastra.service";
import {
  ChatChunkEvent,
  ChatCompleteEvent,
  ChatErrorEvent,
  ConversationHistoryEvent,
  CHAT_EVENTS,
} from '../gateways/mastra-chat/mastra-chat.types';
import {
  ChatHistoryEvent,
  ConversationUpdateEvent,
  CHAT_HISTORY_EVENTS,
} from '../gateways/mastra-chat-history/mastra-chat-history.types';

@Injectable()
export class MastraAgentsService {
  constructor(
    private readonly mastraService: MastraService,
    private readonly eventEmitter: EventEmitter2,
  ) { }

  async chat(message: string, options: { userId: string; threadId: string }) {
    if (!options.userId || !options.threadId) {
      throw new Error("Both userId and threadId are required for chat");
    }

    const agent = this.mastraService.mastra.getAgent("chat-agent");

    return agent.generate(message, {
      resourceId: options.userId,
      threadId: options.threadId,
    });
  }

  async chatStream(
    message: string,
    options: { userId: string; threadId: string; clientId: string },
  ): Promise<void> {
    try {
      const agent = this.mastraService.mastra.getAgent('chat-agent');

      const stream = await agent.stream(message, {
        resourceId: options.userId,
        threadId: options.threadId,
      });

      let chunkIndex = 0;

      // Stream text chunks to client
      for await (const chunk of stream.textStream) {
        this.eventEmitter.emit(
          CHAT_EVENTS.CHUNK,
          {
            clientId: options.clientId,
            text: chunk,
            chunkIndex: chunkIndex++,
          } satisfies ChatChunkEvent,
        );
      }

      // Notify that streaming is complete
      this.eventEmitter.emit(
        CHAT_EVENTS.COMPLETE,
        {
          clientId: options.clientId,
        } satisfies ChatCompleteEvent,
      );

      // Notify that conversations have been updated
      this.eventEmitter.emit(
        CHAT_HISTORY_EVENTS.CONVERSATION_UPDATE,
        { userId: options.userId } satisfies ConversationUpdateEvent,
      );
    } catch (error) {
      this.eventEmitter.emit(
        CHAT_EVENTS.ERROR,
        {
          clientId: options.clientId,
          error: 'Failed to process chat stream',
          details: error.message,
        } satisfies ChatErrorEvent,
      );
    }
  }

  async getConversations(userId: string, clientId: string, type: 'initial' | 'update' = 'initial') {
    if (!userId) {
      throw new Error("userId is required");
    }

    try {
      // Get threads for this user from Mastra storage
      const threadsResult = await this.mastraService.mastra.getStorage().getThreadsByResourceIdPaginated({
        resourceId: userId,
        page: 0,
        perPage: 50,
        orderBy: 'updatedAt',
        sortDirection: 'DESC'
      });

      const conversations = threadsResult?.threads?.map(thread => ({
        threadId: thread.id,
        title: thread.title || 'Untitled Conversation',
        updatedAt: thread.updatedAt,
      })) || [];

      // Emit event for gateway to broadcast
      this.eventEmitter.emit(
        CHAT_HISTORY_EVENTS.CHAT_HISTORY,
        {
          clientId,
          conversations,
          type,
        } satisfies ChatHistoryEvent,
      );

      return conversations;
    } catch (error) {
      console.error("Error fetching conversations:", error);
      throw new Error("Failed to fetch conversations");
    }
  }

  async getConversationMessages(threadId: string, clientId: string) {
    if (!threadId) {
      throw new Error("threadId is required");
    }

    try {
      // Get messages from Mastra storage
      const messages = await this.mastraService.mastra.getStorage().getMessages({
        threadId
      });

      // Transform Mastra messages to frontend message format
      const transformedMessages = messages
        .filter((msg) => msg.role !== 'system') // Filter out system messages
        .map((msg) => ({
          id: msg.id,
          role: (msg.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
          content: (msg.content as any)?.content || '[No content]',
          timestamp: msg.createdAt,
        }))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()); // Sort by timestamp ascending

      // Emit event for gateway to broadcast
      this.eventEmitter.emit(
        CHAT_EVENTS.CONVERSATION_HISTORY,
        {
          clientId,
          messages: transformedMessages,
        } satisfies ConversationHistoryEvent,
      );

      return transformedMessages;
    } catch (error) {
      console.error("Error fetching conversation messages:", error);
      throw new Error("Failed to fetch conversation messages");
    }
  }

  async deleteConversation(threadId: string, userId?: string) {
    if (!threadId) {
      throw new Error("threadId is required");
    }

    try {
      // Delete the thread using Mastra storage
      await this.mastraService.mastra.getStorage().deleteThread({ threadId });

      // Emit conversation update event if userId provided
      if (userId) {
        this.eventEmitter.emit(
          CHAT_HISTORY_EVENTS.CONVERSATION_UPDATE,
          { userId } satisfies ConversationUpdateEvent,
        );
      }

      return true;
    } catch (error) {
      console.error("Error deleting conversation:", error);
      throw new Error("Failed to delete conversation");
    }
  }
}
