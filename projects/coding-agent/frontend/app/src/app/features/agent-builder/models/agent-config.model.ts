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

export interface PromptInfo {
  filename: string;
  name: string;
}

export interface FileEntry {
  name: string;
  type: 'file' | 'directory';
  path: string;
}

export const AVAILABLE_MODELS = [
  { id: 'claude-opus-4-6', name: 'Opus 4.6', description: 'Latest, most capable' },
  { id: 'claude-opus-4-5-20251101', name: 'Opus 4.5', description: 'Most capable' },
  { id: 'claude-sonnet-4-5-20250929', name: 'Sonnet 4.5', description: 'Fast and capable' },
  { id: 'claude-haiku-4-5-20250929', name: 'Haiku 4.5', description: 'Fastest' },
];

export const AVAILABLE_PROVIDERS = [
  { id: 'claude-code' as const, name: 'Claude Code', description: 'Anthropic Claude Code SDK' },
  { id: 'opencode' as const, name: 'OpenCode', description: 'OpenCode with Ollama (coming soon)' },
];

export const AVAILABLE_ICONS = [
  { id: 'smart_toy', label: 'Robot' },
  { id: 'psychology', label: 'Brain' },
  { id: 'lightbulb', label: 'Lightbulb' },
  { id: 'code', label: 'Code' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'build', label: 'Build' },
  { id: 'bug_report', label: 'Bug' },
  { id: 'science', label: 'Science' },
  { id: 'search', label: 'Search' },
  { id: 'edit_note', label: 'Writer' },
  { id: 'architecture', label: 'Architect' },
  { id: 'school', label: 'Teacher' },
  { id: 'support_agent', label: 'Support' },
  { id: 'shield', label: 'Security' },
  { id: 'speed', label: 'Performance' },
  { id: 'data_object', label: 'Data' },
  { id: 'palette', label: 'Design' },
  { id: 'rocket_launch', label: 'Rocket' },
  { id: 'chat', label: 'Chat' },
  { id: 'inventory_2', label: 'Package' },
];

export const AVAILABLE_PAGES = [
  { path: 'ALL', label: 'All Pages' },
  { path: '/projects', label: 'Projects' },
  { path: '/brainstorm', label: 'Brainstorm' },
  { path: '/backlog', label: 'Backlog' },
  { path: '/command-center', label: 'Command Center' },
  { path: '/agents', label: 'Agent Builder' },
];
