export interface Session {
  id: string;
  model: string;
  createdAt: string;
  lastMessageAt?: string;
  isActive: boolean;
}

export interface AgentMessage {
  type: string;
  subtype?: string;
  sessionId?: string;
  content?: string;
  tool?: string;
  input?: unknown;
  output?: unknown;
  [key: string]: unknown;
}
