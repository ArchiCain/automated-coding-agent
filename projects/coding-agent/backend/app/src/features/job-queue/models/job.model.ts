export type JobType = 'auto-decomp' | 'single-decomp';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface JobProgress {
  current: number;
  total: number;
  stage: 'projects' | 'features' | 'concerns' | 'initializing' | 'complete';
  currentItem?: string;
}

export interface AutoDecompPayload {
  planId: string;
  planName: string;
}

export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  progress: JobProgress;
  payload: AutoDecompPayload;
  logs: string[];
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface JobIndex {
  id: string;
  type: JobType;
  status: JobStatus;
  createdAt: string;
  planName: string;
}

export interface CreateJobDto {
  type: JobType;
  payload: AutoDecompPayload;
}

export interface JobLogsResponse {
  logs: string[];
  total: number;
  hasMore: boolean;
}
