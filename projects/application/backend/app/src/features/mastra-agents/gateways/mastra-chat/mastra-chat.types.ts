// Event names for internal pub/sub
export const CHAT_EVENTS = {
  CHUNK: 'mastra.chat.chunk',
  COMPLETE: 'mastra.chat.complete',
  ERROR: 'mastra.chat.error',
  CONVERSATION_HISTORY: 'mastra.chat.conversation_history',
} as const;

// Event payload types
export interface ChatChunkEvent {
  clientId: string;
  text: string;
  chunkIndex: number;
}

export interface ChatCompleteEvent {
  clientId: string;
}

export interface ChatErrorEvent {
  clientId: string;
  error: string;
  details?: string;
}

export interface ConversationHistoryEvent {
  clientId: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
}

// Client message DTOs
export interface SendMessageDto {
  message: string;
}
