# AI Platform Frontend — Overview

## What This Is

An Angular single-page app that serves as the end-user surface of the AI Platform. It provides a Keycloak-authenticated chat experience with an AI agent (Socket.IO), user administration, and backend health/database smoke tests. It is also the benchmark workload the autonomous agent pipeline iterates on end-to-end.

The `<title>` is `AI Platform` (`src/index.html:5`) and the same brand string is rendered in the top toolbar (`src/app/features/app-header/components/app-header/app-header.component.ts:17`).

## Tech Stack

Read from `app/package.json`.

- **Framework:** Angular 21 (`@angular/core ^21.2.0`), standalone components, `ChangeDetectionStrategy.OnPush` everywhere
- **UI:** Angular Material 21 + Angular CDK (`@angular/material ^21.2.6`)
- **State:** Signals (`signal`, `computed`, `input()`, `output()`) for sync state; RxJS (`~7.8.0`) for HTTP
- **Realtime:** `socket.io-client ^4.8.3` (`src/app/features/chat/services/chat.service.ts:28`)
- **Markdown:** `marked ^17`, `ngx-markdown ^21.2`
- **Build:** `@angular/build` (esbuild) via `angular.json`
- **Lint / Format:** `angular-eslint 21.3.1`, `typescript-eslint 8.56.1`, Prettier 3
- **Tests:** Vitest 4 via `@angular/build:unit-test` (`angular.json:72-73`)
- **TS:** 5.9, `strict: true`, `noPropertyAccessFromIndexSignature`, `strictTemplates` (`tsconfig.json`)
- **Path aliases:** `@features/*` -> `src/app/features/*` (`tsconfig.json:18`)

## Bootstrap

- `src/main.ts` bootstraps the standalone `App` component (`src/app/app.ts`).
- `src/app/app.config.ts` wires:
  - `provideRouter(routes)`
  - `provideHttpClient(withInterceptors([authInterceptor, activityInterceptor]))` (`app.config.ts:15`)
  - `provideAnimationsAsync()`
  - `provideAppInitializer(() => inject(AppConfigService).load())` — blocks until `/config.json` is fetched (`app.config.ts:17-20`, `features/api-client/services/app-config.service.ts:24`)
- Runtime config schema: `{ backendUrl: string }` — served from `public/config.json` (default `"/api"`).

## Features

All features live under `src/app/features/`. Each has a `{name}.module.ts` (a thin NgModule wrapper that re-exports standalone components for consumers that still use modules) plus an `index.ts` barrel.

| Feature | Route / Purpose | Description |
|---|---|---|
| `keycloak-auth` | `/login` (public) | Login page, `AuthService` (signals), `authGuard`, `permissionGuard(perm)`, `RequirePermissionDirective`, role->permission mapping (`permissions/permissions.config.ts`) |
| `api-client` | — | `AppConfigService` (runtime `/config.json`), `SessionManagementService` (4 min proactive refresh, 30 min inactivity logout), `WebSocketClientService`, `authInterceptor` (withCredentials + 401 refresh-and-retry), `activityInterceptor` (records activity on every request) |
| `layouts` | wraps all authenticated routes | `AppLayoutComponent` — sticky header + persistent sidenav (desktop) or overlay drawer (<1200px), `LayoutService` breakpoint signals (`services/layout.service.ts:5-9`) |
| `app-header` | — | Sticky `mat-toolbar` with menu toggle, title, `ThemeToggleComponent`, `AvatarMenuComponent` |
| `navigation` | — | `NavigationTreeComponent` (recursive `mat-nav-list` with `mat-expansion-panel` groups), `LeftNavigationSidebarComponent` (280px), `LeftNavigationDrawerComponent` |
| `navigation-config` | — | Static `navigationConfig` (`navigation-config.ts`): Smoke Tests, Chat, Admin > Users (gated by `users:read` in config, not on route) |
| `theme` | — | `ThemeService` — light/dark mode, persisted server-side via `GET/PUT {backendUrl}/theme` (`services/theme.service.ts:39-53`); toggles `html.light-theme` / `html.dark-theme`; Material palettes in `styles/_light-theme.scss`, `_dark-theme.scss` |
| `chat` | `/chat` | Socket.IO client to `{backendUrl}/agent`; session sidebar (CRUD via `ChatApiService`), streaming message list, message input; events `agent:history`, `agent:message`, `agent:done`, `agent:error` |
| `user-management` | `/admin/users`, `/admin/users/new`, `/admin/users/:id` | List/create/edit/delete users via `UserManagementApiService` (`services/user-management.api.ts`); search, sort, paginate; `ConfirmationModalComponent` for delete |
| `testing-tools` | `/smoke-tests` | Backend health check + TypeORM database connectivity check (`services/testing-tools.api.ts`) |
| `shared` | — | `ConfirmationModalComponent` (generic confirm dialog) |

## Standards

| Standard | Description |
|---|---|
| [Coding](standards/coding.md) | Angular 21 standalone patterns, signals, DI, interceptors, routing, file naming |
| [Design](standards/design.md) | Theme variables, Material component customizations, layout, typography |

## Routing

Defined in `src/app/app.routes.ts`.

```
/login                     (public, LoginPage)
/                          (AppLayoutComponent, canActivate: [authGuard])
  ''                       -> redirect 'smoke-tests'
  /smoke-tests             SmokeTestsPage
  /chat                    ChatPage
  /admin/users             UsersPage      (no route guard applied — see Discrepancies)
  /admin/users/new         UserPage
  /admin/users/:id         UserPage
```

- `authGuard` (`features/keycloak-auth/guards/auth.guard.ts`): if `AuthService.isAuthenticated()` is false, calls `checkAuth()` (`GET {backendUrl}/auth/check`) to revive the session from the cookie, otherwise redirects to `/login`.
- `permissionGuard(perm)` exists but is not wired onto any route — the Admin > Users nav item carries a `permission: 'users:read'` marker in `navigation-config.ts:27` that is not enforced by the router.

## Backend Contract Surface

All calls go to `${AppConfigService.backendUrl}` (default `/api`). Every HTTP request gets `withCredentials: true` via `authInterceptor`.

| Method | Path | Caller |
|---|---|---|
| POST | `/auth/login` | `AuthService.login` |
| POST | `/auth/logout` | `AuthService.logout`, `SessionManagementService.logout` |
| POST | `/auth/refresh` | `SessionManagementService.refreshToken` (proactive + 401 retry) |
| GET | `/auth/check` | `AuthService.checkAuth` |
| GET/PUT | `/theme` | `ThemeService` |
| GET | `/health` | `TestingToolsApiService.checkBackendHealth` |
| GET | `/health/database` | `TestingToolsApiService.checkDatabase` |
| GET/POST/PUT/DELETE | `/users`, `/users/:id` | `UserManagementApiService` |
| GET/POST/DELETE | `/agent/sessions`, `/agent/sessions/:id` | `ChatApiService` |
| WS | `/agent` namespace | `ChatService` (Socket.IO) |
