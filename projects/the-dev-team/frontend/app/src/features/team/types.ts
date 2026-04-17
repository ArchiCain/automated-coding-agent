export type TicketStatus =
  | 'created'
  | 'blocked'
  | 'queued'
  | 'in_progress'
  | 'ready_for_sandbox'
  | 'sandbox_deploying'
  | 'sandbox_ready'
  | 'self_testing'
  | 'pr_open'
  | 'code_reviewing'
  | 'code_review_passed'
  | 'code_review_changes_needed'
  | 'design_reviewing'
  | 'approved'
  | 'design_changes_needed'
  | 'merged'
  | 'failed'
  | 'stalled'
  | 'stopped_manually';

export type TicketPhase =
  | 'implementation'
  | 'deployment'
  | 'self_test'
  | 'code_review'
  | 'design_review'
  | 'iteration';

export type AgentRoleName =
  | 'frontend-developer'
  | 'designer'
  | 'devops'
  | 'code-reviewer'
  | 'team-lead';

export type TicketPriority = 'critical' | 'high' | 'medium' | 'low';

export interface AgentInstance {
  sessionId: string;
  name: string;
  role: string;
  phase: TicketPhase;
  startedAt: string;
  endedAt: string | null;
  exitReason: string | null;
}

export interface TicketEvent {
  status: TicketStatus;
  at: string;
  trigger: string;
  detail?: string;
}

export interface Ticket {
  id: string;
  title: string;
  specPath: string;
  planId: string;
  status: TicketStatus;
  assignedRole: AgentRoleName;
  activeAgent: AgentInstance | null;
  agentHistory: AgentInstance[];
  dependsOn: string[];
  priority: TicketPriority;
  branch: string | null;
  worktreePath: string | null;
  sandboxNamespace: string | null;
  prNumber: number | null;
  targetBranch: string;
  history: TicketEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface HandoffNote {
  filename: string;
  content: string;
}

/** Map ticket statuses to kanban columns */
export const STATUS_COLUMNS: Record<string, TicketStatus[]> = {
  'Queued': ['created', 'blocked', 'queued'],
  'In Progress': ['in_progress', 'ready_for_sandbox', 'sandbox_deploying', 'sandbox_ready', 'self_testing'],
  'In Review': ['pr_open', 'code_reviewing', 'code_review_passed', 'design_reviewing'],
  'Changes Needed': ['code_review_changes_needed', 'design_changes_needed'],
  'Done': ['approved', 'merged'],
  'Stopped': ['failed', 'stalled', 'stopped_manually'],
};

/** Role display colors */
export const ROLE_COLORS: Record<string, string> = {
  'frontend-developer': '#58a6ff',
  'designer': '#bc8cff',
  'devops': '#d29922',
  'code-reviewer': '#3fb950',
  'team-lead': '#f85149',
};

/** Priority colors */
export const PRIORITY_COLORS: Record<TicketPriority, string> = {
  critical: '#f85149',
  high: '#d29922',
  medium: '#58a6ff',
  low: '#8b949e',
};
