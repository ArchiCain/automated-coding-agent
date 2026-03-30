import { Routes } from '@angular/router';

export const DECOMPOSITION_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/decomposition-list/decomposition-list').then(
        (m) => m.DecompositionListComponent,
      ),
    title: 'Plan to Projects',
    data: {
      chatbotScope: {
        scopeKey: 'decomposition',
        scopeLabel: 'Decomposition Assistant',
        instructionsFile: '.agent-prompts/decomposition.md',
        knowledgeFiles: [],
      },
    },
  },
  {
    path: 'project-to-features',
    loadComponent: () =>
      import('./pages/project-to-features/project-to-features').then(
        (m) => m.ProjectToFeaturesComponent,
      ),
    title: 'Project to Features',
  },
  {
    path: 'feature-to-concerns',
    loadComponent: () =>
      import('./pages/feature-to-concerns/feature-to-concerns').then(
        (m) => m.FeatureToConcernsComponent,
      ),
    title: 'Feature to Concerns',
  },
  // New nested listing routes for unified decomposition flow
  {
    path: 'plan/:planId/projects',
    loadComponent: () =>
      import('./pages/project-list/project-list').then(
        (m) => m.ProjectListComponent,
      ),
    title: 'Projects',
  },
  {
    path: 'plan/:planId/project/:projectSlug/features',
    loadComponent: () =>
      import('./pages/feature-list/feature-list').then(
        (m) => m.FeatureListComponent,
      ),
    title: 'Features',
  },
  {
    path: 'plan/:planId/project/:projectSlug/feature/:featureSlug/concerns',
    loadComponent: () =>
      import('./pages/concern-list/concern-list').then(
        (m) => m.ConcernListComponent,
      ),
    title: 'Concerns',
  },
  {
    path: ':sessionId',
    loadComponent: () =>
      import('./pages/decomposition-session/decomposition-session').then(
        (m) => m.DecompositionSessionComponent,
      ),
    title: 'Decomposition Session',
  },
];
