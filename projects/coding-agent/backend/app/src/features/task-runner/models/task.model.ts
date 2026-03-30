/**
 * Task definition from `task --list --json`
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
 * Parsed output from `task --list --json`
 */
export interface TaskListOutput {
  tasks: Array<{
    name: string;
    task: string;
    desc: string;
    summary: string;
    aliases: string[];
    up_to_date: boolean;
    location: {
      line: number;
      column: number;
      taskfile: string;
    };
  }>;
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
 * Index entry for quick lookup
 */
export interface TaskExecutionIndex {
  id: string;
  task: string;
  status: TaskExecutionStatus;
  startedAt: string;
  completedAt?: string;
}

/**
 * DTO for running a task
 */
export interface RunTaskDto {
  task: string;
  args?: string[];
}

/**
 * Response for task logs
 */
export interface TaskLogsResponse {
  logs: string[];
  total: number;
  hasMore: boolean;
}
