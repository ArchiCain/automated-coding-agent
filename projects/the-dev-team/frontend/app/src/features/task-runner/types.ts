export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface TaskRunInfo {
  id: string;
  taskName: string;
  vars: Record<string, string>;
  status: TaskStatus;
  startedAt: string;
  finishedAt?: string;
  exitCode?: number;
}
