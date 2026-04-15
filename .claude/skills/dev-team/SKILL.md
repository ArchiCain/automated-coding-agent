---
name: dev-team
description: Work on THE Dev Team frontend and backend — the autonomous coding agent's chat UI, DevOps dashboard, and NestJS API. Use this when the user shows a screenshot of the UI, asks to change a feature, fix a bug, or add new functionality to the dev team services.
allowed-tools: Bash(task *) Bash(kubectl *) Bash(eval *) Bash(docker *) Bash(helm *) Read Edit Write Glob Grep
---

# THE Dev Team Development

You are working on THE Dev Team — an autonomous coding agent with a React chat UI and NestJS backend running in Kubernetes.

## Source layout

### Frontend (`projects/the-dev-team/frontend/app/src/`)

```
features/
├── chat/           # Chat interface — message list, input, session sidebar
│   ├── chat.page.tsx
│   ├── message-list.tsx
│   ├── message-input.tsx
│   ├── session-sidebar.tsx
│   └── use-chat.ts
├── cluster/        # DevOps dashboard — deployments, metrics, log search
│   ├── cluster.page.tsx
│   ├── metrics-panel.tsx
│   ├── logs-panel.tsx
│   ├── namespace-card.tsx
│   ├── log-drawer.tsx
│   ├── use-cluster.ts
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

App.tsx             # Routes: / (chat), /devops (cluster), /docs
main.tsx            # Entry point
```

**Tech stack:** React 18, MUI, Vite, recharts, react-markdown, socket.io-client

### Backend (`projects/the-dev-team/backend/app/src/`)

```
features/
├── agent/          # Core agent service + WebSocket gateway
│   ├── agent.service.ts       # Session management, Claude Code SDK query()
│   ├── agent.gateway.ts       # Socket.io gateway (chat:message, join:session)
│   ├── agent.controller.ts    # REST endpoints
│   ├── github-token.service.ts
│   └── providers/             # LLM provider implementations
│       ├── claude-code.provider.ts
│       ├── provider.interface.ts
│       └── provider-registry.ts
├── cluster/        # Kubernetes cluster API
│   ├── cluster.service.ts     # K8s API calls, Prometheus/Loki queries
│   └── cluster.controller.ts  # REST: /cluster/pods, /cluster/metrics, etc.
├── health/         # /health endpoint
└── cors/           # CORS middleware

mcp-server.ts       # MCP tool server (git ops, workspace ops)
app.module.ts       # Root NestJS module
main.ts             # Entry point (port 8080, CORS enabled)
```

**Tech stack:** NestJS, @anthropic-ai/claude-code SDK, @kubernetes/client-node, socket.io

### Nginx proxy (production)

The frontend container runs nginx (`projects/the-dev-team/frontend/dockerfiles/nginx.conf`):
- `/api/*` → proxied to `the-dev-team-backend:8080/` (strips `/api/` prefix)
- `/socket.io/*` → proxied with WebSocket upgrade
- `/*` → serves static React build with SPA fallback

So the frontend calls `/api/cluster/pods` which nginx routes to the backend's `/cluster/pods`.

## When the user shows a screenshot

1. Identify which page it is from the URL or visual layout:
   - Chat page (`/`) → `features/chat/`
   - DevOps page (`/devops`) → `features/cluster/`
   - Docs page (`/docs`) → `features/docs/`
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

The user accesses services via Tailscale hostnames (configured in `.env`). The tunnel is managed by `task tunnel` in a tmux session. You do NOT need to restart the tunnel after deploying — only the pods change.

## Key patterns

- **API calls from frontend:** All go through `/api/` prefix. The nginx proxy strips it. So `fetch('/api/cluster/pods')` hits the backend's `ClusterController` at `/cluster/pods`.
- **WebSocket:** Socket.io connects via `/socket.io/` (nginx proxies with upgrade). The `AgentGateway` handles events.
- **Helm charts:** Each service has a `chart/` directory. Values come from the helmfile at `infrastructure/k8s/helmfile.yaml.gotmpl`. You rarely need to touch these for feature work.
- **Ingress:** Both services use Traefik (`ingressClassName: traefik`). Frontend at `devteam.{DEV_HOSTNAME}`, backend at `agent-api.{DEV_HOSTNAME}`.

## What NOT to do

- Don't modify the Taskfile, helmfile, or infrastructure for feature changes
- Don't change the nginx.conf unless adding a new proxy route
- Don't run `task up` or `task reset:up` — those rebuild everything. Use the targeted build commands above.
- Don't restart the tunnel — pod restarts don't affect it
