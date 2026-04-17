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

## Features

| Feature | Page | Auth | Description |
|---------|------|------|-------------|
| [Auth](features/auth/requirements.md) | `/login` | Public | Cookie-based Keycloak auth, permission guards, interceptors, login page |
| [Home](features/home/requirements.md) | `/home` | Authenticated | Welcome page with feature cards |
| [Users](features/users/requirements.md) | `/users` | `users:read` | Full CRUD user management with server-side pagination |
| [Smoke Tests](features/smoke-tests/requirements.md) | `/smoke-tests` | Authenticated | Backend health check with auto-refresh |
| [Layout](features/layout/requirements.md) | — | — | App shell: sidenav, responsive nav, user info, logout |
| [Theme](features/theme/requirements.md) | — | — | Dark/light toggle, server-persisted preference |

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

- **Default protected:** `authGuard` on the parent route. All children inherit. Only `/login` is outside.
- **Permission-based:** `permissionGuard('users:read')` on `/users`. Permissions from `GET /auth/check`, resolved server-side.
- **Cookie auth:** `credentialsInterceptor` adds `withCredentials: true` globally. `authErrorInterceptor` handles 401 refresh with retry queue.
- **`provideAuth()`** wires all auth infrastructure in one call in `app.config.ts`.

## Backend

NestJS API with Keycloak, PostgreSQL. Already deployed. See [API contract](../api-contract.md) for endpoint details.

## How This Documentation Works

These docs are the source of truth. To change the frontend:

1. Update the docs (requirements, flows, test data)
2. The diff between docs and code defines the work
3. Agents implement the code to match the docs
4. Designer agent verifies against flows step-by-step
5. Docs are always current because they drove the implementation
