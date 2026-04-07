export interface RoleResult {
  output: string;
  role: string;
  sessionId: string;
  startedAt?: string;
  durationMin?: number;
  cost: number;
  summary?: string;
  transcriptPath?: string;
}
