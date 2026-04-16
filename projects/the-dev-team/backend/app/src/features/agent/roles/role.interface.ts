export interface McpServerConfig {
  type: 'stdio';
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface AgentRole {
  readonly name: string;
  readonly displayName: string;
  readonly description: string;
  buildSystemPrompt(): string;
  readonly allowedTools: string[];
  readonly disallowedTools?: string[];
  readonly mcpServers: Record<string, McpServerConfig>;
}
