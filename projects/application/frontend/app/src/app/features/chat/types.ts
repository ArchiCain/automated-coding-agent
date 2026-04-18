/** A chat session with the AI agent. */
export interface ChatSession {
  id: string;
  model: string;
  role?: string;
  createdAt: string;
  lastMessageAt?: string;
  isActive: boolean;
}

/** A single message in a chat session (user, assistant, tool, error, or system). */
export interface ChatMessage {
  type: 'user' | 'assistant' | 'tool_use' | 'tool_result' | 'error' | 'system';
  sessionId?: string;
  content?: string;
  tool?: string;
  input?: unknown;
  output?: unknown;
}

/** Full message history for a session, received when joining. */
export interface SessionHistory {
  sessionId: string;
  systemPrompt: string;
  messages: ChatMessage[];
}
