export interface AgentConfig {
  id: string;
  slug: string;
  name: string;
  description: string;
  knowledgeFiles: string[];
  cwd: string;
  defaultModel: string;
  provider: 'claude-code' | 'opencode';
  pages: string[];
  icon?: string;
  color?: string;
  hidden?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CreateAgentConfigDto = Omit<AgentConfig, 'id' | 'slug' | 'createdAt' | 'updatedAt'>;
export type UpdateAgentConfigDto = Partial<CreateAgentConfigDto>;
