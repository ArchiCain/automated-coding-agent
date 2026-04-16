export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface TaskRun {
  id: string;
  taskName: string;
  vars: Record<string, string>;
  status: TaskStatus;
  startedAt: Date;
  finishedAt?: Date;
  exitCode?: number;
  output: string[];
}

/** Serializable subset sent to the frontend */
export interface TaskRunInfo {
  id: string;
  taskName: string;
  vars: Record<string, string>;
  status: TaskStatus;
  startedAt: string;
  finishedAt?: string;
  exitCode?: number;
}

export const ALLOWED_TASKS: string[] = [
  // Build
  'build:all',
  'build:backend',
  'build:frontend',
  'build:keycloak',
  'build:the-dev-team-backend',
  'build:the-dev-team-frontend',
  // Deploy
  'deploy:apply',
  'deploy:sync',
  'deploy:destroy',
  'deploy:status',
  'deploy:diff',
  // Cluster lifecycle
  'up',
  'up:build-and-deploy',
  'down',
  'reset',
  'reset:up',
  'status',
  // Sandbox environments
  'env:deploy',
  'env:create',
  'env:destroy',
  'env:status',
  'env:list',
  'env:restart',
  'env:health',
  'env:logs',
  'env:logs-all',
  'env:logs-errors',
  // Minikube
  'minikube:start',
  'minikube:stop',
  // Tests
  'run-all-tests',
  'backend:local:test',
  'frontend:local:test',
  'e2e:test',
];
