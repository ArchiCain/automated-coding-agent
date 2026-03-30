import { Routes } from '@angular/router';

export const BACKLOG_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/backlog-list/backlog-list').then(
        (m) => m.BacklogListComponent,
      ),
    title: 'Backlog',
    data: {
      chatbotScope: {
        scopeKey: 'backlog',
        scopeLabel: 'Backlog Assistant',
        instructionsFile: '.agent-prompts/execution.md',
        knowledgeFiles: [],
      },
    },
  },
  // Development environment setup (before execution)
  {
    path: 'plan/:planId/environment',
    loadComponent: () =>
      import('./pages/dev-environment/dev-environment').then(
        (m) => m.DevEnvironmentComponent,
      ),
    title: 'Development Environment',
  },
  // Backlog session routes with agent card
  {
    path: 'plan/:planId/projects',
    loadComponent: () =>
      import('./pages/backlog-session/backlog-session').then(
        (m) => m.BacklogSessionComponent,
      ),
    title: 'Projects',
  },
  {
    path: 'plan/:planId/project/:projectSlug/features',
    loadComponent: () =>
      import('./pages/backlog-session/backlog-session').then(
        (m) => m.BacklogSessionComponent,
      ),
    title: 'Features',
  },
  {
    path: 'plan/:planId/project/:projectSlug/feature/:featureSlug/concerns',
    loadComponent: () =>
      import('./pages/backlog-session/backlog-session').then(
        (m) => m.BacklogSessionComponent,
      ),
    title: 'Concerns',
  },
  // Execution session for running a specific task
  {
    path: 'execute/:sessionId',
    loadComponent: () =>
      import('./pages/execution-session/execution-session').then(
        (m) => m.ExecutionSessionComponent,
      ),
    title: 'Execution Session',
  },
];
