export interface CodingAgentProvider {
  readonly id: string;
  readonly name: string;
  execute(request: AgentExecutionRequest): AsyncIterable<AgentMessage>;
  healthCheck(): Promise<ProviderHealthStatus>;
  capabilities(): ProviderCapabilities;
}

export interface AgentExecutionRequest {
  prompt: string;
  cwd: string;
  systemPrompt: string;
  allowedTools: string[];
  sessionId?: string;
  resume?: boolean;       // Only set when resuming an existing session
  signal?: AbortSignal;
}

export interface AgentMessage {
  type: 'text' | 'tool_use' | 'tool_result' | 'error' | 'status' | 'complete';
  content: string;
  raw?: unknown;
}

export interface ProviderCapabilities {
  shellExecution: boolean;
  fileOperations: boolean;
  agenticLoop: boolean;
  sessionResume: boolean;
  contextWindow: number;
}

export interface ProviderHealthStatus {
  healthy: boolean;
  message?: string;
  latencyMs?: number;
}
