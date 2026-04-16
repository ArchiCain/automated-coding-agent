export interface ChatSession {
  id: string;
  model: string;
  role?: string;
  createdAt: string;
  lastMessageAt?: string;
  isActive: boolean;
}

export interface ChatMessage {
  type: 'user' | 'assistant' | 'tool_use' | 'tool_result' | 'error' | 'system';
  sessionId?: string;
  content?: string;
  tool?: string;
  input?: unknown;
  output?: unknown;
}

export interface SessionHistory {
  sessionId: string;
  systemPrompt: string;
  messages: ChatMessage[];
}
