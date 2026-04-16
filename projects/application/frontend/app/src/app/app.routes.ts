import { Routes } from '@angular/router';

import { authGuard } from './features/keycloak-auth/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/keycloak-auth/pages/login.page').then(m => m.LoginPage),
  },
  {
    path: '',
    loadComponent: () =>
      import('./features/layouts/components/app-layout/app-layout.component').then(
        m => m.AppLayoutComponent,
      ),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'smoke-tests', pathMatch: 'full' },
      {
        path: 'smoke-tests',
        loadComponent: () =>
          import('./features/testing-tools/pages/smoke-tests.page').then(m => m.SmokeTestsPage),
      },
      {
        path: 'admin/users',
        loadComponent: () =>
          import('./features/user-management/pages/users.page').then(m => m.UsersPage),
      },
      {
        path: 'admin/users/new',
        loadComponent: () =>
          import('./features/user-management/pages/user.page').then(m => m.UserPage),
      },
      {
        path: 'admin/users/:id',
        loadComponent: () =>
          import('./features/user-management/pages/user.page').then(m => m.UserPage),
      },
      {
        path: 'chat',
        loadComponent: () =>
          import('./features/chat/pages/chat.page').then(m => m.ChatPage),
      },
    ],
  },
];
