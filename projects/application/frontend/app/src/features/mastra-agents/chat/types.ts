export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface ConversationHistoryEvent {
  messages: Message[];
}

export interface ResponseChunkEvent {
  text: string;
  chunkIndex: number;
}

export interface ChatErrorEvent {
  error: string;
  details?: string;
}
