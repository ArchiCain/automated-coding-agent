export type TaskRole =
  | 'architect'
  | 'implementer'
  | 'reviewer'
  | 'tester'
  | 'designer'
  | 'bugfixer'
  | 'documentarian'
  | 'monitor'
  | 'devops';

export interface ProviderConfig {
  engine: 'anthropic' | 'opencode';
  provider?: string;
  model: string;
}

export type ExecutionMode = 'local' | 'sandbox';

export interface DevTeamConfig {
  default: ProviderConfig;
  roles: Partial<Record<TaskRole, ProviderConfig>>;
  maxConcurrent: number;
  retryBudget: number;
  keepEnvironmentForReview: boolean;
  executionMode: ExecutionMode;
}
