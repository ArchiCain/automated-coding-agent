/**
 * Options passed to an agent provider for executing a query
 */
export interface AgentQueryOptions {
  cwd: string;
  model: string;
  systemPrompt?: string;
  abortController: AbortController;
  resume?: string;
  env?: Record<string, string>;
  readOnly?: boolean;
  additionalDirectories?: string[];
}

/**
 * Generic message yielded by an agent provider during streaming
 */
export interface AgentMessage {
  type: string;
  subtype?: string;
  [key: string]: unknown;
}

/**
 * Interface for agent SDK providers (Claude Code, OpenCode, etc.)
 */
export interface AgentProvider {
  readonly name: string;

  /**
   * Execute a prompt and yield streaming messages
   */
  query(prompt: string, options: AgentQueryOptions): AsyncIterable<AgentMessage>;

  /**
   * Check if this provider is available and configured
   */
  isAvailable(): Promise<boolean>;
}
