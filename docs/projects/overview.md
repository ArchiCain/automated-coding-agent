# Projects Overview

All deployable services live under `projects/`, organised into two groups.

```
projects/
├── application/         # Main product (K8s namespace: app)
│   ├── backend/
│   ├── frontend/
│   ├── database/
│   ├── keycloak/
│   └── e2e/
└── the-dev-team/        # THE Dev Team (K8s namespace: the-dev-team)
    ├── backend/         # Agent API + Claude Code SDK + MCP server
    └── frontend/        # Chat UI + DevOps dashboard + docs viewer
```

Each project follows a consistent layout:

```
project-name/
├── app/                # Source code
├── dockerfiles/        # Container definitions (local + prod)
├── chart/              # Helm chart for K8s deployment
├── Taskfile.yml        # Project-level automation
└── README.md
```

## Application

The main product -- a full-stack web application with AI features. Deployed to the `app` K8s namespace.

| Project | Stack | Purpose |
|---------|-------|---------|
| [Backend](application/backend.md) | NestJS 11 | REST API, WebSocket chat, database, AI agents, Keycloak auth |
| [Frontend](application/frontend.md) | React 19 + Vite 6 | Conversational AI UI, user management |
| [Database](application/database.md) | PostgreSQL 16 + pgvector | Shared database infrastructure |
| [Keycloak](application/keycloak.md) | Keycloak 23 | Authentication and authorisation |
| [E2E Tests](application/e2e.md) | Playwright 1.48 | Browser-based end-to-end tests |

When a task runs, THE Dev Team can deploy an entire copy of this stack into an ephemeral namespace (`env-{name}`) so the agent can validate changes against a live environment. See [Sandbox Environments](../the-dev-team/sandbox-environments.md).

## THE Dev Team

The autonomous coding agent. A backend service handles Claude Code SDK integration and exposes structured tools via MCP; a frontend provides the chat interface and DevOps observability. Both are deployed to the `the-dev-team` K8s namespace.

| Project | Stack | Purpose |
|---------|-------|---------|
| [Backend](the-dev-team/backend.md) | NestJS 11 + Claude Code SDK | Session management, WebSocket gateway, MCP tool server, cluster introspection |
| [Frontend](the-dev-team/frontend.md) | React 19 + Vite + MUI | Chat UI, DevOps dashboard (deployments/metrics/logs), docs viewer |

Both services live under `projects/the-dev-team/`.

## Conventions

### Feature-based architecture

All application code lives inside `src/features/`. There are no separate `pages/` or `endpoints/` directories at the project root.

```
src/
└── features/
    ├── auth/            # Full feature: controllers + services + guards
    ├── user-dashboard/  # Full feature: pages + components + hooks
    └── api-client/      # Shared feature: reusable utilities
```

Features are either **full-stack** (with pages/endpoints, representing a complete user-facing capability) or **shared** (reusable utilities consumed by other features).

### NestJS module pattern

Every backend feature must have its own NestJS module. `app.module.ts` should only import feature modules:

```typescript
// Good
@Module({ imports: [HealthModule, AuthModule, UsersModule] })
export class AppModule {}

// Bad — never import controllers/services directly in app.module
@Module({ controllers: [HealthController] })
export class AppModule {}
```

### Naming conventions

- Directories: `kebab-case` (e.g. `user-dashboard`, `api-client`)
- Frontend pages: `*.page.tsx`
- Backend controllers: `*.controller.ts`
- Tests: `*.spec.ts` (backend unit), `*.integration.spec.ts` (backend integration), `*.test.tsx` (frontend)
