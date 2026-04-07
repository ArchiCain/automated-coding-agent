export type TaskStatus =
  | "queued"
  | "assigned"
  | "setting_up"
  | "implementing"
  | "validating"
  | "submitting"
  | "completed"
  | "failed"
  | "escalated";

export type TaskSource = "github_issue" | "slack" | "api" | "manual";

export type TaskPriority = "low" | "medium" | "high" | "critical";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  source: TaskSource;
  priority: TaskPriority;
  touchesFrontend?: boolean;
  branch?: string;
  assignedSlot?: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  cost?: number;
  error?: string;
}

export type AgentSlotStatus = "idle" | "active" | "error" | "starting";

export interface AgentSlot {
  id: number;
  status: AgentSlotStatus;
  taskId?: string;
  taskTitle?: string;
  currentRole?: string;
  startedAt?: string;
  progress?: number;
  lastMessage?: string;
}

export type AgentMessageType =
  | "text"
  | "tool_use"
  | "tool_result"
  | "error"
  | "status";

export interface AgentMessage {
  id: string;
  taskId: string;
  slotId: number;
  type: AgentMessageType;
  role: string;
  content: string;
  timestamp: string;
  toolName?: string;
}

export interface GateResult {
  taskId: string;
  gate: string;
  passed: boolean;
  details: string;
  timestamp: string;
}

export type TranscriptEventType =
  | "task_created"
  | "task_started"
  | "agent_message"
  | "tool_call"
  | "tool_result"
  | "gate_check"
  | "task_completed"
  | "task_failed"
  | "error";

export interface TranscriptEvent {
  id: string;
  taskId: string;
  type: TranscriptEventType;
  role?: string;
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

/** Shape returned by /api/history/sessions/:taskId */
export interface SessionTranscript {
  role: string;
  sessionId: string;
  eventCount: number;
  events: TranscriptEvent[];
}

export interface Environment {
  taskId: string;
  namespace: string;
  podStatus: "running" | "pending" | "failed" | "terminating";
  healthStatus: "healthy" | "unhealthy" | "unknown";
  age: string;
  ingressUrls: string[];
}

export interface HistoryTask {
  id: string;
  title: string;
  status: TaskStatus;
  source: TaskSource;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  cost?: number;
}
