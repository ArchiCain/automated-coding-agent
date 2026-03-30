// Event names for internal pub/sub
export const CHAT_HISTORY_EVENTS = {
  CHAT_HISTORY: 'mastra.history.chat_history',
  CONVERSATION_UPDATE: 'mastra.history.conversation_update',
} as const;

// Event payload types
export interface ChatHistoryEvent {
  clientId: string;
  conversations: Array<{
    threadId: string;
    title: string;
    updatedAt: Date;
  }>;
  type: 'initial' | 'update';
}

export interface ConversationUpdateEvent {
  userId: string;
}

// Client message DTOs
export interface DeleteConversationDto {
  threadId: string;
}
