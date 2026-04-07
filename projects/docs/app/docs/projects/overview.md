# Projects Overview

All deployable services live under `projects/`, organised into three groups with a shared documentation site.

```
projects/
├── application/         # Main product (K8s namespace: app)
│   ├── backend/
│   ├── frontend/
│   ├── database/
│   ├── keycloak/
│   └── e2e/
├── coding-agent/        # THE Dev Team (K8s namespace: coding-agent)
│   ├── backend/         # Orchestrator
│   └── dashboard/       # Observability dashboard
└── docs/                # Documentation site
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

The main product — a full-stack web application with AI features. Deployed to the `app` K8s namespace.

| Project | Stack | Purpose |
|---------|-------|---------|
| [Backend](application/backend.md) | NestJS 11 | REST API, WebSocket chat, database, AI agents, Keycloak auth |
| [Frontend](application/frontend.md) | React 19 + Vite 6 | Conversational AI UI, user management |
| [Database](application/database.md) | PostgreSQL 16 + pgvector | Shared database infrastructure |
| [Keycloak](application/keycloak.md) | Keycloak 23 | Authentication and authorisation |
| [E2E Tests](application/e2e.md) | Playwright 1.48 | Browser-based end-to-end tests |

When a task runs, THE Dev Team deploys an entire copy of this stack into an ephemeral namespace (`env-{task-id}`) so the agent can validate its work against a live environment. See [Sandbox Environments](../the-dev-team/sandbox-environments.md).

## THE Dev Team

The autonomous development system: an orchestrator, a dashboard, and a shared skills library. Both services are deployed to the `coding-agent` K8s namespace.

| Project | Stack | Purpose |
|---------|-------|---------|
| [Orchestrator](coding-agent/backend.md) | NestJS 11 + Claude Code SDK | Task intake, agent pool, execution loop, validation gates, PR management |
| [Dashboard](coding-agent/dashboard.md) | React 19 + Vite + MUI 6 | Real-time observability into agents, tasks, environments, history |
| [Task State & History](coding-agent/backlog.md) | File-based + git | Per-task state, findings, session transcripts, searchable archive |

The orchestrator and dashboard both live under `projects/coding-agent/`. The runtime data directory is `.the-dev-team/` at the repo root, and the shared skills library is at `skills/`.

Read the [THE Dev Team Overview](../the-dev-team/overview.md) for the mental model before diving into individual services.

## Docs

MkDocs Material site (this one). Deployed to the `app` namespace as `docs.localhost` locally and `docs.mac-mini` (or production domain) in the cluster.

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
