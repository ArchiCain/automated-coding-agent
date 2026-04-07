export interface AgentSlot {
  id: number;
  taskId?: string;
  status: 'idle' | 'active';
  worktreePath?: string;
  namespace?: string;
  currentRole?: string;
  startedAt?: Date;
}
