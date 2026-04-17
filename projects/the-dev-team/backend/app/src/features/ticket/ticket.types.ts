/** All possible ticket states */
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

/** Which phase of the ticket pipeline an agent is working */
export type TicketPhase =
  | 'implementation'
  | 'deployment'
  | 'self_test'
  | 'code_review'
  | 'design_review'
  | 'iteration';

/** Agent roles that can be assigned to tickets */
export type AgentRoleName =
  | 'frontend-developer'
  | 'designer'
  | 'devops'
  | 'code-reviewer'
  | 'team-lead';

export type TicketPriority = 'critical' | 'high' | 'medium' | 'low';

export type TransitionTrigger = 'team-lead' | 'ticket-engine' | 'watchdog' | 'agent' | 'user';

export type AgentExitReason = 'completed' | 'crashed' | 'stopped_manually' | 'watchdog_killed';

/** An agent instance that worked (or is working) on a ticket */
export interface AgentInstance {
  sessionId: string;
  name: string;
  role: string;
  phase: TicketPhase;
  startedAt: string;
  endedAt: string | null;
  exitReason: AgentExitReason | null;
}

/** A single event in a ticket's history */
export interface TicketEvent {
  status: TicketStatus;
  at: string;
  trigger: TransitionTrigger;
  detail?: string;
}

/** The core ticket data model */
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

/** DTO for creating a new ticket */
export interface CreateTicketDto {
  title: string;
  specPath: string;
  planId: string;
  assignedRole: AgentRoleName;
  priority: TicketPriority;
  dependsOn?: string[];
  targetBranch?: string;
}

/** Name pool structure stored at .dev-team/names.json */
export interface NamePool {
  pool: string[];
  assigned: Record<string, { ticketId: string; role: string; sessionId: string }>;
}

/** Valid state transitions — source status → allowed target statuses */
export const VALID_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  created: ['queued', 'blocked', 'stopped_manually'],
  blocked: ['queued', 'stopped_manually'],
  queued: ['in_progress', 'stopped_manually'],
  in_progress: ['ready_for_sandbox', 'failed', 'stalled', 'stopped_manually'],
  ready_for_sandbox: ['sandbox_deploying', 'failed', 'stalled', 'stopped_manually'],
  sandbox_deploying: ['sandbox_ready', 'failed', 'stalled', 'stopped_manually'],
  sandbox_ready: ['self_testing', 'failed', 'stalled', 'stopped_manually'],
  self_testing: ['pr_open', 'in_progress', 'failed', 'stalled', 'stopped_manually'],
  pr_open: ['code_reviewing', 'failed', 'stalled', 'stopped_manually'],
  code_reviewing: ['code_review_passed', 'code_review_changes_needed', 'failed', 'stalled', 'stopped_manually'],
  code_review_passed: ['design_reviewing', 'failed', 'stalled', 'stopped_manually'],
  code_review_changes_needed: ['in_progress', 'stalled', 'stopped_manually'],
  design_reviewing: ['approved', 'design_changes_needed', 'failed', 'stalled', 'stopped_manually'],
  design_changes_needed: ['in_progress', 'stalled', 'stopped_manually'],
  approved: ['merged', 'stopped_manually'],
  merged: [],
  failed: ['queued', 'stopped_manually'],
  stalled: ['queued', 'failed', 'stopped_manually'],
  stopped_manually: ['queued'],
};

/** Statuses that indicate an agent should be actively working */
export const ACTIVE_STATUSES: TicketStatus[] = [
  'in_progress',
  'sandbox_deploying',
  'self_testing',
  'code_reviewing',
  'design_reviewing',
];

/** Default name pool */
export const DEFAULT_NAME_POOL: string[] = [
  'Bob', 'Hank', 'Frank', 'Dale', 'Peggy', 'Bill',
  'Nancy', 'Lou', 'Gus', 'Marge', 'Earl', 'Dot',
  'Rusty', 'Sal', 'Norm', 'Bev', 'Roy', 'Flo',
  'Clyde', 'Barb', 'Vince', 'June', 'Walt', 'Dee',
  'Lenny', 'Bonnie', 'Hector', 'Iris', 'Milo', 'Opal',
];
