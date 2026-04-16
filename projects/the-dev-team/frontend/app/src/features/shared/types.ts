export interface Session {
  id: string;
  model: string;
  role?: string;
  createdAt: string;
  lastMessageAt?: string;
  isActive: boolean;
}

export interface AgentRoleInfo {
  name: string;
  displayName: string;
  description: string;
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

export interface SessionHistory {
  sessionId: string;
  systemPrompt: string;
  messages: AgentMessage[];
}
