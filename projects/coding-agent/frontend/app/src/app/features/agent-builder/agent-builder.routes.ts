import { Routes } from '@angular/router';

export const AGENT_BUILDER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/agent-list/agent-list').then(
        (m) => m.AgentListComponent,
      ),
    title: 'Agents',
    data: {
      chatbotScope: {
        scopeKey: 'agent-builder',
        scopeLabel: 'Agent Builder',
        instructionsFile: '.agent-prompts/brainstorming.md',
        knowledgeFiles: [],
      },
    },
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./pages/agent-editor/agent-editor').then(
        (m) => m.AgentEditorComponent,
      ),
    title: 'New Agent',
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./pages/agent-editor/agent-editor').then(
        (m) => m.AgentEditorComponent,
      ),
    title: 'Edit Agent',
  },
];
