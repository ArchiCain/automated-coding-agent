export interface ChatbotScopeContext {
  scopeKey: string;
  scopeLabel: string;
  instructionsFile: string;
  knowledgeFiles: string[];
  cwd?: string;
  provider?: 'claude-code' | 'opencode';
  readOnly?: boolean;
  defaultModel?: string;
  agentSlug?: string;
  agentIcon?: string;
  agentColor?: string;
}
