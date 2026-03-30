import { Routes } from '@angular/router';

export const PROJECTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/projects-list/projects-list').then(
        (m) => m.ProjectsListComponent,
      ),
    title: 'Projects',
    data: {
      chatbotScope: {
        scopeKey: 'projects',
        scopeLabel: 'Repo Overview',
        instructionsFile: '.agent-prompts/projects-overview.md',
        knowledgeFiles: ['docs/project-architecture.md'],
      },
    },
  },
  {
    path: ':projectId',
    loadComponent: () =>
      import('./pages/project-detail/project-detail').then(
        (m) => m.ProjectDetailComponent,
      ),
    title: 'Project',
  },
  {
    path: ':projectId/features/:featureId',
    loadComponent: () =>
      import('./pages/feature-detail/feature-detail').then(
        (m) => m.FeatureDetailComponent,
      ),
    title: 'Feature',
  },
];
