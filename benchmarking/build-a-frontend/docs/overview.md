# Benchmark Frontend — Overview

## What This Is

An Angular frontend for managing users and monitoring backend health, secured by Keycloak authentication with permission-based access control. Built as a benchmark to test THE Dev Team's autonomous agent pipeline.

## Tech Stack

- **Framework:** Angular 19 (standalone components, signals, OnPush)
- **UI Library:** Angular Material (Material Design, dark + light themes)
- **Auth:** Keycloak via HTTP-only cookies (no client-side token handling)
- **State:** Signals for sync state, RxJS for async (HTTP)
- **Forms:** ReactiveFormsModule only
- **Config:** Runtime `/config.json` (no build-time env vars)

## Pages

| Page | Route | Auth | Description |
|------|-------|------|-------------|
| [Login](pages/login/requirements.md) | `/login` | Public | Email + password authentication |
| [Welcome](pages/welcome/requirements.md) | `/home` | Authenticated | Informational landing with feature cards |
| [User Management](pages/users/requirements.md) | `/users` | `users:read` | Full CRUD user table with dialogs |
| [Smoke Tests](pages/smoke-tests/requirements.md) | `/smoke-tests` | Authenticated | Backend health check with auto-refresh |

## Shared Features

| Feature | Description |
|---------|-------------|
| [Auth](shared/auth/requirements.md) | Cookie-based session, permissions, guards, interceptors |
| [Layout](shared/layout/requirements.md) | Sidenav, responsive nav, user info |
| [Theme](shared/theme/requirements.md) | Dark/light toggle, server-persisted preference |

## Standards

| Standard | Description |
|----------|-------------|
| [Coding](standards/coding.md) | Angular patterns, project structure, file naming |
| [Design](standards/design.md) | Color palette, typography, component patterns, spacing |

## Architecture

```
/login ──────────────────────────────────────────────────┐
                                                          │ (public)
                                                          │
/ ─── LayoutComponent (authGuard) ───┬── /home            │
                                     ├── /users (users:read)
                                     ├── /smoke-tests     │
                                     └── redirect → /home │
```

- **Default protected:** `authGuard` on the parent route. All children inherit it. Only `/login` is outside.
- **Permission-based:** `permissionGuard('users:read')` on `/users`. Permissions come from `GET /auth/check`, resolved server-side.
- **Cookie auth:** `credentialsInterceptor` adds `withCredentials: true` globally. `authErrorInterceptor` handles 401 refresh with retry queue.
- **`provideAuth()`** wires all auth infrastructure in one call in `app.config.ts`.

## Backend

NestJS API with Keycloak, PostgreSQL. Already deployed. See [API contract](../api-contract.md) for endpoint details.

## How This Documentation Works

These docs are the source of truth. To change the frontend:

1. Update the docs (requirements, flows, components, test data)
2. The diff between docs and code defines the work
3. Agents implement the code to match the docs
4. Designer agent verifies against `flows.md` step-by-step
5. Docs are always current because they drove the implementation

See `docs/development/documentation-standard.md` for the global documentation philosophy.
