# Backend — Overview

## What This Is

A NestJS REST API that fronts Keycloak for authentication and user administration, persists per-user theme preferences to PostgreSQL via TypeORM, and exposes a generic soft-delete CRUD pattern for future entities. JWTs are carried in HTTP-only cookies; auth is enforced by a global guard with opt-out via `@Public()`.

## Tech Stack

From `app/package.json`:

- **Framework:** NestJS 11 (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`) on Node 22 Alpine (`dockerfiles/prod.Dockerfile:2`)
- **Auth:** Keycloak via direct `fetch` calls to `realms/{realm}/protocol/openid-connect/*` (`src/features/keycloak-auth/services/keycloak-auth.service.ts`); JWT decoded with `jose` (`jose.decodeJwt`, `keycloak-auth.service.ts:158`) — **signature is NOT verified against JWKS** (see Discrepancies)
- **Database:** PostgreSQL via `@nestjs/typeorm` + `typeorm` + `pg`; schema `example_schema`; migrations auto-run on startup (`typeorm-database-client.module.ts:53`)
- **Validation:** `class-validator`, `class-transformer` (used in theme DTOs only — no global `ValidationPipe` registered)
- **Cookies:** `cookie-parser` middleware mounted in `src/main.ts:9`
- **Websockets:** `@nestjs/websockets` + `socket.io` — the `chat-agent` feature exposes a Socket.IO gateway on namespace `/agent` (`chat-agent/gateways/chat-agent.gateway.ts`)
- **Agent runtime:** `@mastra/core` + `@mastra/memory` (LibSQL storage) + `@ai-sdk/anthropic` — used only by the `chat-agent` feature
- **Swagger:** `@nestjs/swagger` decorators on `ThemeController` only; no `SwaggerModule.setup()` call in `main.ts`
- **Testing:** Jest unit (`jest.config.js`, `*.spec.ts` under `src/`) + integration (`jest.integration.config.js`, `test/**/*.integration.spec.ts`)

## Features

| Feature | Base Route | Auth | Description |
|---------|-----------|------|-------------|
| [keycloak-auth](../app/src/features/keycloak-auth) | `/auth` | Mix (see below) | Login, logout, refresh, session check; provides `KeycloakJwtGuard` (global), `PermissionGuard`, `@Public()`, `@KeycloakUser()`, `@RequirePermission()` (`keycloak-auth/controllers/keycloak-auth.controller.ts:18`) |
| [user-management](../app/src/features/user-management) | `/users` | `@RequirePermission('users:*')` — **guard not attached, see Discrepancies** | CRUD over Keycloak Admin API using client-credentials grant; soft-delete via `enabled=false` (`user-management/services/user-management.service.ts`) |
| [theme](../app/src/features/theme) | `/theme` | JWT via `@UseGuards(KeycloakJwtGuard)` on controller (`theme/controllers/theme.controller.ts:18`) | Get/update user light-or-dark theme preference; defaults to `dark`; persisted in `user_theme` table (`typeorm-database-client/entities/user-theme.entity.ts`) |
| [health](../app/src/features/health) | `/health` | `@Public()` (`health/controllers/health.controller.ts:4`) | Returns `{ status, timestamp, service }` |
| [typeorm-database-client](../app/src/features/typeorm-database-client) | `/examples` (demo) | No auth opt-out → JWT required by global guard | TypeORM connection, `BaseEntity` with soft-delete, `TypeormGenericCrudService`, and demo `ExampleCrudController` |
| [cors](../app/src/features/cors) | — | — | Parses `CORS_ORIGINS` env var (`*`, `false/none`, or comma list) and feeds `app.enableCors` in `src/main.ts:13` |
| [chat-agent](../app/src/features/chat-agent) | `/agent/sessions` + WS `/agent` | REST: JWT required; WS: no auth today | Single Mastra agent (Anthropic Haiku) with per-session memory; REST for session CRUD, Socket.IO for streaming chat |

## Standards

| Standard | Description |
|----------|-------------|
| [Coding](standards/coding.md) | NestJS feature-module layout, naming, guards/decorators, error handling, testing |

## Architecture

```
HTTP request
  -> express (app.listen on PORT, src/main.ts:16)
  -> cookie-parser (src/main.ts:9)
  -> CORS (src/main.ts:13, origins from CORS_ORIGINS)
  -> Global APP_GUARD: KeycloakJwtGuard (src/app.module.ts:23-28)
       - reads access_token cookie OR Authorization: Bearer header
       - decodes JWT via jose.decodeJwt (no signature verification)
       - attaches KeycloakUserProfile to request.user
       - skipped when route/class has @Public()
  -> Controller method
       - @UseGuards(KeycloakJwtGuard) on ThemeController (redundant with global)
       - @RequirePermission('...') on UserManagementController (metadata only, see below)
  -> Service
       - KeycloakAuthService / UserManagementService -> fetch() to Keycloak
       - ThemeService -> TypeORM UserTheme repository
       - TypeormGenericCrudService -> entity-agnostic CRUD with soft delete
```

## Roles and Permissions

Derived from `src/features/keycloak-auth/permissions/permissions.constants.ts`:

| Role | Permissions |
|------|-------------|
| `admin` | `users:read`, `users:create`, `users:update`, `users:delete`, `conversations:read`, `conversations:create`, `conversations:delete` |
| `user` | `conversations:read`, `conversations:create` |

Role-to-permission mapping lives in `ROLE_PERMISSIONS` (`permissions.constants.ts:29`). `getPermissionsForRoles()` dedupes across multiple roles.

## Key Environment Variables

| Var | Consumed in | Purpose |
|-----|-------------|---------|
| `PORT` | `src/main.ts:15` | Listen port |
| `NODE_ENV` | `keycloak-auth.controller.ts:23-27` | Gates cookie `secure` + `sameSite=strict` |
| `CORS_ORIGINS` | `cors/cors-config.ts:76` | `*`, `false/none`, or comma-delimited origin list |
| `KEYCLOAK_BASE_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET` | `keycloak-auth.service.ts:15-18`, `user-management.service.ts:53-59` | Keycloak OIDC + Admin API |
| `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, `DATABASE_NAME` | `typeorm-database-client.module.ts:23-37` | PostgreSQL connection (all required — throws if missing) |
| `DATABASE_SSL`, `DATABASE_LOGGING` | same | Optional flags; `DATABASE_SYNC` is ignored — hardcoded to `false` (`typeorm-database-client.module.ts:29`) |
| `ANTHROPIC_API_KEY` | `@ai-sdk/anthropic` (read automatically) | Required by `chat-agent` — injected via `secretEnv` in the Helm chart |
| `CHAT_MEMORY_DB_URL` | `chat-agent/agents/chat.agent.ts:17` | LibSQL URL for Mastra memory; defaults to `file:./chat-memory.db` |

## Deployment

- **Local dev:** `task backend:local:start` runs `docker compose` against `infrastructure/docker/compose.yml` service `backend` (`Taskfile.yml:17`). Dockerfile `dockerfiles/local.Dockerfile` installs deps at container start via `scripts/start-dev.sh`.
- **Production:** Multi-stage build in `dockerfiles/prod.Dockerfile` — `deps` → `builder` (`npm run build`) → runtime `node dist/main` via `scripts/start-prod.sh`. Exposes port 8080.
- **Migrations:** Run automatically on boot (`migrationsRun: true`, `typeorm-database-client.module.ts:53`). Managed via `npm run migration:*` scripts / `task backend:local:migration:*`.
