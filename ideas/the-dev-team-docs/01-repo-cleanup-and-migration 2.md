# 01 — Repo Cleanup & Migration

## Goal

Remove dead code, unused dependencies, and deprecated patterns from the repo. Prepare the codebase so that THE Dev Team orchestrator can be built on a clean foundation.

## Current State

The repo contains several components that are being replaced:

- **`projects/openclaw/`** — OpenClaw gateway config, SOUL.md, and skill definitions. Being replaced entirely by THE Dev Team.
- **`projects/coding-agent/frontend/`** — Angular 21 frontend for the coding agent UI. Being replaced by a React dashboard consistent with the main app (`projects/application/frontend/`).
- **`infrastructure/docker/compose.yml`** — Docker Compose setup for local dev with 9 services. Being replaced by Minikube (everything in K8s from day one).
- **Mastra agent framework** in `projects/application/backend/` — `@mastra/core`, `@mastra/pg`, `@ai-sdk/*` packages used for multi-provider agents. Being replaced by the `CodingAgentProvider` abstraction.
- **OpenClaw references** in Docker Compose, Taskfile, Helm charts, and `.env`.

## Implementation Steps

### Step 1: Remove OpenClaw

```bash
rm -rf projects/openclaw/
```

Remove OpenClaw from:
- `infrastructure/docker/compose.yml` — the `openclaw-gateway` service definition
- `infrastructure/k8s/helmfile.yaml.gotmpl` — any OpenClaw Helm releases
- `infrastructure/k8s/charts/` — OpenClaw chart if it exists
- `.env` — `OPENCLAW_*` variables (`CLAUDE_CODE_OAUTH_TOKEN`, `OPENCLAW_AUTH_TOKEN`, `OPENCLAW_PORT`)
- Root `Taskfile.yml` — any `openclaw:*` task includes or references

### Step 2: Remove Angular Coding Agent Frontend

```bash
rm -rf projects/coding-agent/frontend/
```

Remove from:
- `infrastructure/docker/compose.yml` — the `coding-agent-frontend` service
- Root `Taskfile.yml` — `coding-agent-frontend:*` includes
- Any Helm charts referencing the Angular frontend
- Dockerfiles for `coding-agent-frontend`

### Step 3: Remove Mastra and AI SDK Dependencies

In `projects/application/backend/package.json`, remove:
- `@mastra/core`
- `@mastra/pg`
- `@ai-sdk/anthropic` (if present)
- `@ai-sdk/google` (if present)
- `@ai-sdk/openai` (if present)
- Any other `@mastra/*` or `@ai-sdk/*` packages

Remove the Mastra agents feature module:
- `projects/application/backend/src/features/mastra-agents/` — the entire directory
- Remove the `MastraAgentsModule` import from `projects/application/backend/src/app.module.ts`

In `projects/application/frontend/`, remove:
- `src/features/mastra-agents/` — the chat UI components that depend on Mastra
- Remove route and navigation references to the Mastra chat feature

### Step 4: Clean Up Docker Compose

If Docker Compose is being fully replaced by Minikube, the file can be kept temporarily but marked as deprecated, or removed outright. Decision point:
- **Option A (safe):** Keep `compose.yml` but add a comment that it's deprecated. Remove after Minikube is working.
- **Option B (clean):** Remove `compose.yml` and `infrastructure/docker/` entirely now.

Recommendation: **Option A** — keep it until `02-infrastructure-minikube-nix.md` is complete.

### Step 5: Clean Up .env

Remove variables that are no longer needed:
- `OPENCLAW_*` variables
- `COMPOSE_PROJECT_NAME` (if dropping Docker Compose)
- Any Mastra-specific env vars

Keep:
- `ANTHROPIC_API_KEY` — needed for Claude Code SDK
- `GITHUB_TOKEN` — needed for bot account
- Database, Keycloak, port configs — needed for the application
- `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY` — needed if using OpenCode providers

### Step 6: Rename Coding Agent Backend

The `projects/coding-agent/backend/` becomes THE Dev Team orchestrator. This can be a rename or just conceptual — the directory can stay as-is initially and be renamed later:

```
projects/coding-agent/backend/ → projects/the-dev-team/
```

Or keep the path and just update the service name in configs. The rename is cosmetic but signals the shift.

### Step 7: Run Builds and Tests

After cleanup:
```bash
cd projects/application/backend && npm install && npm run build
cd projects/application/frontend && npm install && npm run build
cd projects/coding-agent/backend && npm install && npm run build
```

Fix any broken imports or missing references caused by the removal.

## Verification

- [ ] `projects/openclaw/` does not exist
- [ ] `projects/coding-agent/frontend/` does not exist
- [ ] No `@mastra/*` or `@ai-sdk/*` in any `package.json`
- [ ] `npm run build` succeeds for application backend, application frontend, and coding-agent backend
- [ ] No references to OpenClaw in Taskfile, Helm charts, or Docker Compose
- [ ] `.env` has no orphaned variables

## Open Questions

- **Rename now or later?** Should `projects/coding-agent/backend/` be renamed to `projects/the-dev-team/` immediately, or after the orchestrator refactor is done? Renaming now is cleaner but causes more git churn.
- **Keep Docker Compose?** If Minikube setup (Plan 02) will take time, keeping Docker Compose as a fallback is pragmatic.
