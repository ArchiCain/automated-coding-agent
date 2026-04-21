export interface ChatSession {
  id: string;
  model: string;
  role?: string;
  createdAt: string;
  lastMessageAt?: string;
  isActive: boolean;
}

export type ChatMessageType =
  | "user"
  | "assistant"
  | "tool_use"
  | "tool_result"
  | "error"
  | "system";

export interface ChatMessage {
  type: ChatMessageType;
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
