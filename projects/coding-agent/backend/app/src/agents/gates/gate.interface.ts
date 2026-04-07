export interface ValidationGate {
  name: string;
  description: string;
  phase: 1 | 2;
  applicableTo: 'all' | 'frontend' | 'backend';
  run(context: GateContext): Promise<GateResult>;
}

export interface GateContext {
  taskId: string;
  worktreePath: string;
  namespace: string;
  branch: string;
  touchesFrontend: boolean;
  touchesBackend: boolean;
  executionMode: 'local' | 'sandbox';
}

export interface GateResult {
  gate: string;
  passed: boolean;
  output: string;
  details?: Record<string, unknown>;
  durationMs: number;
  attempt: number;
}
