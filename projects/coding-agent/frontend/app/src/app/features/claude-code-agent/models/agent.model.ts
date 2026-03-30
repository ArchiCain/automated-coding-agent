/**
 * Agent status - represents the current state of an agent
 */
export type AgentStatus = 'idle' | 'active' | 'paused' | 'completed' | 'failed';

/**
 * Agent activity type - what the agent is currently doing
 */
export type AgentActivityType =
  | 'thinking'
  | 'reading'
  | 'writing'
  | 'executing'
  | 'waiting';

/**
 * Current activity of the agent
 */
export interface AgentActivity {
  type: AgentActivityType;
  description: string;
  startedAt: string;
}

/**
 * Document attached to an agent
 */
export interface AgentDocument {
  id: string;
  name: string;
  path: string;
  type: 'prompt' | 'context' | 'attachment' | 'output';
  mimeType?: string;
}

/**
 * Agent type/category definition
 */
export interface AgentType {
  id: string;
  name: string;
  description: string;
  icon: string;
  color?: string;
}

/**
 * Agent session metadata
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
 * Agent configuration - editable when idle
 */
export interface AgentConfig {
  cwd: string;
  model: string;
  promptFile?: string;
  contextFiles: string[];
  attachments: AgentDocument[];
}

/**
 * Complete agent state for the component
 */
export interface Agent {
  // Identity
  id: string;
  name: string;
  description: string;
  icon: string;
  instructions?: string; // Quick-start tip shown in UI

  // Type/category
  type: AgentType;

  // Current state
  status: AgentStatus;
  activity?: AgentActivity;

  // Documents (for display in card mode)
  documents: AgentDocument[];

  // Configuration (editable when idle)
  config?: AgentConfig;

  // Session info (when active)
  session?: AgentSession;

  // Error info (when failed)
  error?: string;
}

/**
 * Available models
 */
export const AVAILABLE_MODELS = [
  { id: 'claude-opus-4-5-20251101', name: 'Opus 4.5', description: 'Most capable (default)' },
  { id: 'claude-sonnet-4-5-20250929', name: 'Sonnet 4.5', description: 'Fast and capable' },
  { id: 'claude-haiku-4-5-20250929', name: 'Haiku 4.5', description: 'Fastest' },
];

/**
 * Agent component display mode
 */
export type AgentDisplayMode = 'card' | 'interactive';

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
