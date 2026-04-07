export type TaskStatus =
  | 'queued'
  | 'assigned'
  | 'setting_up'
  | 'implementing'
  | 'validating'
  | 'submitting'
  | 'completed'
  | 'failed'
  | 'escalated';

export interface Task {
  id: string;
  title: string;
  description: string;
  source: 'github_issue' | 'manual' | 'decomposition' | 'pr_feedback' | 'ci_failure';
  sourceRef?: string;
  status: TaskStatus;
  priority: number;
  branch: string;
  worktreePath?: string;
  namespace?: string;
  touchesFrontend: boolean;
  parentTaskId?: string;
  dependencies: string[];
  retryBudget: number;
  estimatedFiles?: string[];
  prNumber?: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  cost: number;
  gateResults?: GateResultSummary[];
  changedFiles?: string[];
}

export interface GateResultSummary {
  gate: string;
  passed: boolean;
  attempt: number;
  notes?: string;
}

export interface CreateTaskInput {
  title: string;
  description: string;
  source: Task['source'];
  sourceRef?: string;
  branch?: string;
  priority?: number;
  touchesFrontend?: boolean;
  parentTaskId?: string;
  dependencies?: string[];
}

export interface TaskResult {
  status: 'completed' | 'failed';
  error?: string;
  cost: number;
}
