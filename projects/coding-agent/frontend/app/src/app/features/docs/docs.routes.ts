import { Routes } from '@angular/router';

export const DOCS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/docs-list/docs-list').then(
        (m) => m.DocsListComponent
      ),
  },
];
