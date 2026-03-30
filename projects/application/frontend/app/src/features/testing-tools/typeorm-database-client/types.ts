// Types for the TypeORM Database Client package

// Entity types matching the backend
export interface ExampleEntity {
  id: string;
  name: string;
  description?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

// DTO types for API calls
export interface CreateExampleDto {
  name: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface UpdateExampleDto {
  name?: string;
  description?: string;
  metadata?: Record<string, any>;
}

// Test state and result types
export interface TestStep {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message: string;
  duration?: number;
  details?: any;
}

export interface TestResult {
  success: boolean;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  duration: number;
  steps: TestStep[];
}

export interface TestState {
  isRunning: boolean;
  result: TestResult | null;
  currentStep: number;
  error: string | null;
  lastRun: Date | null;
  createdRecords: ExampleEntity[];
  updatedRecord: ExampleEntity | null;
  deletedRecord: ExampleEntity | null;
}

// API response types
export interface ApiError {
  message: string;
  statusCode?: number;
  details?: any;
}
