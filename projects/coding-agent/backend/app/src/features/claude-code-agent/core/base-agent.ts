/**
 * Agent status
 */
export type AgentStatus = 'idle' | 'active' | 'paused' | 'completed' | 'failed';

/**
 * Agent activity type
 */
export type AgentActivityType =
  | 'thinking'
  | 'reading'
  | 'writing'
  | 'executing'
  | 'waiting';

/**
 * Current activity
 */
export interface AgentActivity {
  type: AgentActivityType;
  description: string;
  startedAt: string;
}

/**
 * Agent document
 */
export interface AgentDocument {
  id: string;
  name: string;
  path: string;
  type: 'prompt' | 'context' | 'attachment' | 'output';
  mimeType?: string;
}

/**
 * Agent type definition
 */
export interface AgentType {
  id: string;
  name: string;
  description: string;
  icon: string;
  color?: string;
}

/**
 * Agent session
 */
export interface AgentSession {
  sessionId: string;
  startedAt: string;
  lastActivityAt: string;
  completedAt?: string;
  model: string;
  cwd: string;
}

/**
 * Complete agent state
 */
export interface AgentState {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: AgentType;
  status: AgentStatus;
  activity?: AgentActivity;
  documents: AgentDocument[];
  session?: AgentSession;
  error?: string;
}

/**
 * Predefined agent types
 */
export const AGENT_TYPES: Record<string, AgentType> = {
  brainstorming: {
    id: 'brainstorming',
    name: 'Brainstorming',
    description: 'Helps develop and refine project plans',
    icon: 'lightbulb',
    color: '#ffc107',
  },
  decomposition: {
    id: 'decomposition',
    name: 'Decomposition',
    description: 'Breaks down tasks into smaller components',
    icon: 'account_tree',
    color: '#1976d2',
  },
  general: {
    id: 'general',
    name: 'General',
    description: 'General-purpose coding assistant',
    icon: 'smart_toy',
    color: '#7c4dff',
  },
  development: {
    id: 'development',
    name: 'Development',
    description: 'Specialized development tasks',
    icon: 'code',
    color: '#00897b',
  },
  review: {
    id: 'review',
    name: 'Review',
    description: 'Code review and analysis',
    icon: 'rate_review',
    color: '#f57c00',
  },
  execution: {
    id: 'execution',
    name: 'Execution',
    description: 'Implements tasks from the backlog',
    icon: 'play_circle',
    color: '#4caf50',
  },
};
