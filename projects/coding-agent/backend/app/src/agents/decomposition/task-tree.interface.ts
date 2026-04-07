export interface TaskTree {
  id: string;
  title: string;
  description: string;
  source: string;
  rootNode: TaskNode;
}

export interface TaskNode {
  id: string;
  type: 'project' | 'feature' | 'concern' | 'task';
  title: string;
  description: string;
  children: TaskNode[];
  dependencies: string[];
  status: TaskNodeStatus;
  assignedAgent?: number;
  estimatedFiles?: string[];
}

export type TaskNodeStatus =
  | 'pending'
  | 'ready'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'blocked';
