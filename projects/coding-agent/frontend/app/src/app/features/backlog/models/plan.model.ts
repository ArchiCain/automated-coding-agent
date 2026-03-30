// Task status types
export type TaskStatus = 'not_ready' | 'ready' | 'executing' | 'completed' | 'failed';

export interface TaskStatusFile {
  status: TaskStatus;
  updatedAt?: string;
  error?: string;
}

export interface TaskItem {
  name: string;
  path: string;
  status: TaskStatus;
  hasChildren: boolean;
  childCount?: number;
}

export interface ProjectTask extends TaskItem {
  featuresCount?: number;
}

export interface FeatureTask extends TaskItem {
  concernsCount?: number;
}

export interface ConcernTask extends TaskItem {
  dependsOn?: string[];
}

// Reset result types
export interface ResetResult {
  success: boolean;
  deletedCount: number;
}
