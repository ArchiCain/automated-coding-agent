---
name: dev-team
description: Work on THE Dev Team frontend and backend — the autonomous coding agent's chat UI, DevOps dashboard, orchestration router, and NestJS API. Use this when the user shows a screenshot of the UI, asks to change a feature, fix a bug, or add new functionality to the dev team services.
allowed-tools: Bash(task *) Bash(kubectl *) Bash(eval *) Bash(docker *) Bash(helm *) Read Edit Write Glob Grep
---

# THE Dev Team Development

You are working on THE Dev Team — an autonomous coding agent platform with a React UI and NestJS backend running in Kubernetes. The system orchestrates multiple AI agent roles (Designer, Frontend Owner) that collaborate via GitHub issues and PRs.

## Source layout

### Frontend (`projects/the-dev-team/frontend/app/src/`)

```
features/
├── environments/   # Environment-based UI — landing, env detail, app detail
│   ├── environments-overview.page.tsx   # Landing page (/)
│   ├── environment-detail.page.tsx      # Env deep dive (/env/:name)
│   ├── application-detail.page.tsx      # App deep dive (/env/:name/app/:appName)
│   ├── environment-chat-panel.tsx       # Embedded chat panel (right side)
│   ├── use-environments.ts             # Groups K8s namespaces into environments
│   └── types.ts
├── chat/           # Chat interface — message list, input, session sidebar
│   ├── chat.page.tsx
│   ├── message-list.tsx
│   ├── message-input.tsx
│   ├── session-sidebar.tsx
│   └── use-chat.ts
├── cluster/        # DevOps dashboard — deployments, metrics, log search
│   ├── cluster.page.tsx
│   ├── service-table.tsx      # Reusable service/pod table
│   ├── metrics-panel.tsx
│   ├── logs-panel.tsx
│   ├── namespace-card.tsx
│   ├── log-drawer.tsx
│   ├── use-cluster.ts
│   └── types.ts
├── task-runner/    # Global task runner drawer (persists across navigation)
│   ├── task-runner-drawer.tsx  # Bottom drawer with tabs per task
│   ├── task-runner-context.tsx # React context wrapping the hook
│   ├── use-task-runner.ts      # Socket.io /task-runner + REST
│   └── types.ts
├── docs/           # Docs viewer
│   └── docs.page.tsx
├── mui-theme/      # MUI theme (dark mode)
│   ├── theme.ts
│   └── mui-theme-provider.tsx
├── navigation/     # Top nav bar
│   └── nav-bar.tsx
└── shared/         # Shared types
    └── types.ts

App.tsx             # Routes: / (environments), /env/:name, /env/:name/app/:appName, /cluster, /docs
main.tsx            # Entry point
```

**Tech stack:** React 19, MUI, Vite, recharts, react-markdown, socket.io-client

### Backend (`projects/the-dev-team/backend/app/src/`)

```
features/
├── agent/          # Core agent service + WebSocket gateway
│   ├── agent.service.ts         # Session CRUD, runMessage() for headless invocation
│   ├── agent.gateway.ts         # Socket.io gateway (chat:message, join:session)
│   ├── agent.controller.ts      # REST: sessions, roles
│   ├── github-token.service.ts  # GitHub App token (auto-refresh every 50min)
│   ├── normalize-message.ts     # Claude SDK message → frontend format
│   ├── providers/
│   │   ├── claude-code.provider.ts  # Claude Code SDK query() with MCP + tools
│   │   ├── provider.interface.ts
│   │   └── provider-registry.ts
│   └── roles/                   # Agent role definitions
│       ├── role.interface.ts    # AgentRole interface
│       ├── role-registry.ts     # Role lookup by name
│       ├── default.role.ts      # General-purpose agent
│       ├── designer.role.ts     # UI/UX reviewer (Playwright + GitHub issues)
│       └── frontend-owner.role.ts  # Angular developer (file ops + workspace)
├── router/         # Orchestration — polls GitHub, spawns agents
│   ├── router.service.ts        # Poll loop: issues → agents, PRs → reviews
│   ├── router.types.ts          # RouterState, IssueSummary, PrSummary
│   └── router.module.ts
├── task-runner/    # Taskfile execution + WebSocket streaming
│   ├── task-runner.service.ts   # Spawn tasks, track output
│   ├── task-runner.gateway.ts   # Socket.io /task-runner namespace
│   ├── task-runner.controller.ts
│   └── task-runner.types.ts
├── cluster/        # Kubernetes cluster API
│   ├── cluster.service.ts       # K8s API, Prometheus/Loki queries
│   └── cluster.controller.ts
├── health/         # /health endpoint
└── cors/           # CORS middleware

mcp-server.ts             # Workspace MCP server (git + sandbox + PR tools)
github-issues-mcp.ts      # Designer MCP server (create_github_issue)
playwright-cdp-launcher.ts # Playwright MCP via CDP to headless Chrome sidecar
app.module.ts              # Root NestJS module
main.ts                    # Entry point (port 8080)
```

**Tech stack:** NestJS, @anthropic-ai/claude-code SDK (Opus 4.6), @kubernetes/client-node, socket.io

## Orchestration flow

The system runs an autonomous loop:

```
Designer reviews main → files GitHub issue (labels: frontend, design)
    ↓
Router (30s poll) detects labeled issue → spawns Frontend Owner
    ↓
Frontend Owner reads issue → creates worktree → implements → deploys sandbox → opens draft PR
    ↓
Router detects draft PR → spawns Designer for review
    ↓
Designer visits sandbox via Playwright → submits review
    ├── REQUEST_CHANGES → Router spawns FE Owner to iterate (loop back ↑)
    └── mark_pr_ready → Human merges → Router cleans up sandbox + worktree
```

### Agent roles

| Role | Model | Tools | Purpose |
|------|-------|-------|---------|
| `designer` | Opus 4.6 | Playwright MCP, GitHub Issues MCP, PR review tools | Visual review via headless Chrome, file issues, review PRs |
| `frontend-owner` | Opus 4.6 | File ops (Read/Write/Edit/Glob/Grep), Workspace MCP | Implement features in worktrees, deploy sandboxes, open draft PRs |
| `default` | Opus 4.6 | File ops, Workspace MCP | General-purpose agent for manual chat sessions |

### Router state

Persisted to `$REPO_ROOT/.dev-team/router/state.json`:
- `routedIssues` — issue numbers already dispatched (prevents re-routing)
- `designerRoutedForPrCommit` — PR → last commit SHA Designer reviewed
- `feOwnerRoutedForPrReview` — PR → last review ID FE Owner addressed
- `cleanedPrs` — closed/merged PRs already cleaned up

### MCP servers

Three MCP servers run as stdio subprocesses of Claude Code:

1. **Workspace MCP** (`mcp-server.ts`) — git ops, worktree/sandbox lifecycle, PR tools (push_and_pr, review_pr, mark_pr_ready, comment_pr, read_pr_reviews, read_github_issue)
2. **GitHub Issues MCP** (`github-issues-mcp.ts`) — Designer-only, creates issues with labels
3. **Playwright CDP MCP** (`playwright-cdp-launcher.ts`) — connects to headless Chrome sidecar via CDP

### Headless Chrome sidecar

A `zenika/alpine-chrome` pod runs in the `the-dev-team` namespace alongside the backend. Exposes CDP on port 9222. The Playwright MCP connects via `ws://headless-chrome:9222`. This gives the Designer visual review capability without installing Chrome in the backend container.

### Nginx proxy (production)

The frontend container runs nginx (`projects/the-dev-team/frontend/dockerfiles/nginx.conf`):
- `/api/*` → proxied to `the-dev-team-backend:8080/` (strips `/api/` prefix)
- `/socket.io/*` → proxied with WebSocket upgrade
- `/*` → serves static React build with SPA fallback

## When the user shows a screenshot

1. Identify which page it is from the URL or visual layout:
   - Environments overview (`/`) → `features/environments/environments-overview.page.tsx`
   - Environment detail (`/env/:name`) → `features/environments/environment-detail.page.tsx`
   - Application detail (`/env/:name/app/:appName`) → `features/environments/application-detail.page.tsx`
   - Cluster (`/cluster`) → `features/cluster/cluster.page.tsx`
   - Docs (`/docs`) → `features/docs/docs.page.tsx`
2. Read the relevant source files to understand current behavior
3. Make the changes
4. Deploy to verify (see below)

## Deploying changes

After making code changes, build and deploy to the local Minikube cluster:

```bash
# Build the changed image(s) into Minikube's Docker daemon
eval $(minikube docker-env) && docker build --build-arg CACHEBUST=$(date +%s) -t localhost:30500/the-dev-team-frontend:latest -f projects/the-dev-team/frontend/dockerfiles/prod.Dockerfile projects/the-dev-team/frontend && docker push localhost:30500/the-dev-team-frontend:latest

# For backend changes:
eval $(minikube docker-env) && docker build --build-arg CACHEBUST=$(date +%s) -t localhost:30500/the-dev-team-backend:latest -f projects/the-dev-team/backend/dockerfiles/prod.Dockerfile projects/the-dev-team/backend && docker push localhost:30500/the-dev-team-backend:latest

# Restart the deployment to pick up the new image
kubectl rollout restart deployment/the-dev-team-frontend -n the-dev-team
kubectl rollout restart deployment/the-dev-team-backend -n the-dev-team

# Wait for it to be ready
kubectl rollout status deployment/the-dev-team-frontend -n the-dev-team --timeout=120s
kubectl rollout status deployment/the-dev-team-backend -n the-dev-team --timeout=120s
```

The user accesses services via Tailscale hostnames (configured in `.env`). You do NOT need to restart the tunnel after deploying — only the pods change.

## Key patterns

- **API calls from frontend:** All go through `/api/` prefix. The nginx proxy strips it. So `fetch('/api/cluster/pods')` hits the backend's `ClusterController` at `/cluster/pods`.
- **WebSocket:** Socket.io connects via `/socket.io/` (nginx proxies with upgrade). The `AgentGateway` handles events. Task runner uses a separate `/task-runner` namespace.
- **Agent sessions:** Created via REST (`POST /agent/sessions`) or headless via `agentService.createSession()` + `runMessage()`. The router uses headless invocation; the UI uses WebSocket.
- **Roles:** Each role defines `allowedTools`, `disallowedTools`, `mcpServers`, and a `buildSystemPrompt()`. Roles are registered in `role-registry.ts`.
- **GitHub auth:** GitHub App installation tokens (1-hour TTL, auto-refreshed every 50min by `GithubTokenService`). Written to `/workspace/.git-credentials`. MCP servers re-read the file before every command.
- **Helm charts:** Each service has a `chart/` directory. Values come from `infrastructure/k8s/helmfile.yaml.gotmpl`.
- **Ingress:** Traefik (`ingressClassName: traefik`). Frontend at `devteam.{DEV_HOSTNAME}`, backend at `agent-api.{DEV_HOSTNAME}`. Sandboxes at `app.env-{name}.{DEV_HOSTNAME}`.

## What NOT to do

- Don't modify the Taskfile, helmfile, or infrastructure for feature changes
- Don't change the nginx.conf unless adding a new proxy route
- Don't run `task up` or `task reset:up` — those rebuild everything. Use the targeted build commands above.
- Don't restart the tunnel — pod restarts don't affect it
- Don't hardcode model names outside `agent.service.ts` — the default model (`claude-opus-4-6`) is set in one place
