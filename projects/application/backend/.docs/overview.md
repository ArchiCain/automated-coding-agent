# Backend — Overview

## What This Is

A NestJS REST API that handles authentication (via Keycloak), user management, theme preferences, and database access for the benchmark application. Secured with JWT tokens stored in HTTP-only cookies.

## Tech Stack

- **Framework:** NestJS (TypeScript)
- **Auth:** Keycloak OpenID Connect, JWT via HTTP-only cookies
- **Database:** PostgreSQL via TypeORM
- **Token handling:** jose library for JWT validation/decoding

## Features

| Feature | Base Route | Auth | Description |
|---------|-----------|------|-------------|
| [Auth](features/auth/requirements.md) | `/auth` | Public/Protected | Login, logout, token refresh, session check via Keycloak |
| [Users](features/users/requirements.md) | `/users` | `users:*` permissions | Full CRUD user management via Keycloak Admin API |
| [Theme](features/theme/requirements.md) | `/theme` | JWT required | User theme preference (light/dark) persisted to database |
| [Health](features/health/requirements.md) | `/health` | Public | Service health check |
| [Database](features/database/requirements.md) | — | — | TypeORM connection, entities, migrations, generic CRUD |

## Standards

| Standard | Description |
|----------|-------------|
| [Coding](standards/coding.md) | NestJS patterns, module structure, naming conventions |

## Architecture

```
Request → CORS → CookieParser → KeycloakJwtGuard (global)
                                       │
                    ┌──────────────────┼──────────────────┐
                    │ @Public()        │ JWT required      │ + @RequirePermission()
                    │                  │                   │
               /health            /auth/check          /users (users:read)
               /auth/login        /theme               /users/:id (users:update)
```

- **Global guard:** `KeycloakJwtGuard` validates JWT on every request. Routes marked `@Public()` skip validation.
- **Permission guard:** `@RequirePermission('users:read')` checks user permissions extracted from JWT roles.
- **Cookie auth:** Tokens stored in HTTP-only cookies. `access_token` and `refresh_token` set on login.

## Roles & Permissions

| Role | Permissions |
|------|------------|
| `admin` | users:read, users:create, users:update, users:delete, conversations:read, conversations:create, conversations:delete |
| `user` | conversations:read, conversations:create |
