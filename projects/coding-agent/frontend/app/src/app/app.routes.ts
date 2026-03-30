import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'projects',
    pathMatch: 'full',
  },
  {
    path: 'projects',
    loadChildren: () =>
      import('./features/projects/projects.routes').then(
        (m) => m.PROJECTS_ROUTES,
      ),
  },
  {
    path: 'brainstorm',
    loadChildren: () =>
      import('./features/brainstorm/brainstorm.routes').then(
        (m) => m.BRAINSTORM_ROUTES,
      ),
  },
  {
    path: 'decomposition',
    loadChildren: () =>
      import('./features/decomposition/decomposition.routes').then(
        (m) => m.DECOMPOSITION_ROUTES,
      ),
  },
  {
    path: 'backlog',
    loadChildren: () =>
      import('./features/backlog/backlog.routes').then(
        (m) => m.BACKLOG_ROUTES,
      ),
  },
  {
    path: 'command-center',
    loadComponent: () =>
      import('./features/command-center/pages/command-center-dashboard/command-center-dashboard.component').then(
        (m) => m.CommandCenterDashboardComponent,
      ),
  },
  {
    path: 'agents',
    loadChildren: () =>
      import('./features/agent-builder/agent-builder.routes').then(
        (m) => m.AGENT_BUILDER_ROUTES,
      ),
  },
];
