/**
 * Task definition from the backend
 */
export interface TaskDefinition {
  name: string;
  desc: string;
  summary?: string;
  location: {
    taskfile: string;
    line: number;
    column: number;
  };
}

/**
 * Status of a task execution
 */
export type TaskExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * A task execution instance
 */
export interface TaskExecution {
  id: string;
  task: string;
  args?: string[];
  status: TaskExecutionStatus;
  pid?: number;
  output: string[];
  exitCode?: number;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

/**
 * DTO for running a task
 */
export interface RunTaskRequest {
  task: string;
  args?: string[];
}
