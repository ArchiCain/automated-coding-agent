# THE Dev Team — Handoff Document

## What This Is

An autonomous coding agent system that runs in Kubernetes. You chat with a Claude Code agent through a web UI, and the agent can read/write code, manage git branches, deploy sandbox environments, and create PRs — all through structured MCP tools (no arbitrary bash access).

## Architecture

```
projects/the-dev-team/
├── backend/         # NestJS API + Claude Code SDK + MCP tools
└── frontend/        # React chat UI + cluster visualization
```

Both run in K8s in the `the-dev-team` namespace. The agent operates on a cloned copy of the repo at `/workspace` inside the backend pod (PVC-backed).

## How It Works

**User** types a message in the chat UI (React frontend at port 3002).
**Frontend** sends it via WebSocket to the backend.
**Backend** passes it to Claude Code SDK's `query()` function.
**Claude Code** processes it with access to these tools only:
- **File ops**: Read, Write, Edit, Glob, Grep (built-in Claude Code tools)
- **Git** (MCP): git_status, git_diff, git_log, git_checkout, git_add, git_commit, git_push, git_pull, git_stash, git_branch
- **Workspace** (MCP): create_worktree, deploy_sandbox, destroy_sandbox, list_sandboxes, sandbox_status, sandbox_logs, push_and_pr

**No Bash access.** The agent cannot run arbitrary commands. Every operation is a structured tool call.

## Key Files

### Backend (`projects/the-dev-team/backend/app/src/`)

| File | Purpose |
|------|---------|
| `main.ts` | Entry point — loads .env from REPO_ROOT, bootstraps NestJS |
| `app.module.ts` | Root module: Health, CORS, Agent, Cluster modules |
| `features/agent/agent.service.ts` | Session management, system prompt, dispatches to provider |
| `features/agent/agent.gateway.ts` | WebSocket gateway — normalizes Claude SDK messages for frontend |
| `features/agent/agent.controller.ts` | REST: create/list/delete sessions, cancel |
| `features/agent/github-token.service.ts` | GitHub App JWT → installation token (auto-refresh) |
| `features/agent/providers/claude-code.provider.ts` | Claude Code SDK integration, MCP server config, allowedTools whitelist |
| `features/agent/providers/provider.interface.ts` | AgentProvider, AgentMessage, AgentQueryOptions interfaces |
| `features/agent/providers/opencode.provider.ts` | OpenCode stub (functional when CLI installed) |
| `features/cluster/cluster.service.ts` | K8s API client — pods, services, metrics, logs |
| `features/cluster/cluster.controller.ts` | REST: /cluster/pods, /cluster/services, /cluster/metrics, /cluster/logs |
| `mcp-server.ts` | MCP tool server — git + workspace tools exposed to Claude Code |

### Frontend (`projects/the-dev-team/frontend/app/src/`)

| File | Purpose |
|------|---------|
| `App.tsx` | Routes: / (chat), /cluster (cluster view), shared NavBar |
| `features/chat/use-chat.ts` | WebSocket hook — manages sessions, messages, streaming state |
| `features/chat/chat.page.tsx` | Full-page chat: sidebar + message list + input |
| `features/chat/message-list.tsx` | Terminal-style message rendering (markdown, tool use, errors) |
| `features/cluster/cluster.page.tsx` | K8s visualization: namespace cards, infra accordion |
| `features/cluster/namespace-card.tsx` | Pod table with status dots, ports, CPU/memory |
| `features/cluster/log-drawer.tsx` | Bottom drawer showing pod logs when you click a service |

### Infrastructure

| File | Purpose |
|------|---------|
| `infrastructure/k8s/helmfile.yaml.gotmpl` | Helmfile deploying all services (app + the-dev-team) |
| `infrastructure/k8s/charts/full-stack/` | Umbrella Helm chart for sandbox environments |
| `infrastructure/agent-envs/Taskfile.yml` | env:deploy, env:destroy, env:create, env:list, etc. |
| `scripts/setup-k8s-secrets.sh` | Creates K8s namespace + GitHub App key secret from .env |
| `scripts/setup-minikube.sh` | Starts Colima + Minikube with addons |

### Config / Auth

| Item | Location |
|------|----------|
| Dev Team config | `.the-dev-team/config/the-dev-team.config.yml` |
| GitHub App key | `.github-app-private-key.pem` (gitignored) |
| Environment vars | `.env` (gitignored, copy from `.env.template`) |
| K8s secrets | Created by `task setup-secrets` |

## Environment Variables (.env)

```bash
DEV_HOSTNAME=shawns-macbook-pro      # Used for ingress hostnames
CLAUDE_CODE_OAUTH_TOKEN=sk-ant-...   # Claude Code auth
GITHUB_APP_ID=3304807                # GitHub App
GITHUB_APP_CLIENT_ID=Iv23li...       # GitHub App
GITHUB_APP_INSTALLATION_ID=122115421 # GitHub App
GITHUB_APP_PRIVATE_KEY_PATH=.github-app-private-key.pem
GITHUB_APP_PRIVATE_KEY_SECRET=github-app-key  # K8s secret name
REGISTRY=10.110.241.170              # In-cluster registry ClusterIP
```

## How to Start

```bash
nix develop                  # Get all CLI tools
task setup-secrets           # First time: create K8s secrets
task up                      # Build images → deploy to Minikube
task open                    # Port-forward: localhost:3002 (UI), localhost:8086 (API)
```

## Known Issues / Next Steps

### Docker socket permissions in sandbox deployment
The `deploy_sandbox` MCP tool fails with "Permission denied while trying to connect to Docker API". The backend pod needs the Docker socket mounted and the agent user needs permission to use it. The Helm chart has `docker.socketMount: true` but the socket permissions may need adjusting (add agent user to docker group, or mount with correct GID).

### Sandbox deployment flow
The full flow is: `create_worktree` → make changes → `deploy_sandbox` → test → `push_and_pr`. Currently `create_worktree` and git tools work. `deploy_sandbox` needs the Docker socket fix. The `env:deploy` Taskfile task handles: docker build → push to registry → helm install full-stack chart → wait for health.

### Taskfile shell execution in K8s pod
The `task` command's `|` blocks may not execute properly inside the Nix-based container. If `env:deploy` fails, the fallback is to implement the deploy logic directly in the MCP server using docker/kubectl/helm commands (the code was started but reverted — see git history for the approach).

### Things that work well
- Chat UI with WebSocket streaming
- MCP tools (git_status, git_diff, git_add, git_commit, git_push, create_worktree, push_and_pr)
- Cluster page with namespace cards, pod status, services, ports, CPU/memory
- Log viewer (click any service row)
- GitHub App auth (auto-refreshing installation tokens)
- Session management with resume support
- Bash disabled — agent restricted to file ops + MCP tools only

### Feature ideas for next sessions
- Fix Docker socket for sandbox deployment end-to-end
- Add more MCP tools (npm install, npm test, npm build — controlled, no arbitrary bash)
- Session history persistence (currently in-memory, lost on pod restart)
- Multiple concurrent sessions / agents
- Deploy to Mac Mini (K3s) — deploy workflow exists, needs secrets configured
- CLAUDE.md in the workspace to give the agent repo-specific context

## Project Structure

```
automated-coding-agent/
├── projects/
│   ├── application/          # The main app being developed
│   │   ├── backend/          # NestJS REST API
│   │   ├── frontend/         # React SPA
│   │   ├── database/         # PostgreSQL
│   │   ├── keycloak/         # Auth
│   │   └── e2e/              # Playwright tests
│   ├── the-dev-team/         # THE Dev Team (autonomous coding agent)
│   │   ├── backend/          # Agent backend (NestJS + Claude Code SDK)
│   │   └── frontend/         # Chat UI + cluster page
│   └── docs/                 # MkDocs documentation site
├── infrastructure/
│   ├── k8s/                  # Helmfile, charts, environments
│   ├── agent-envs/           # Taskfile for sandbox lifecycle
│   ├── minikube/             # Local cluster setup
│   └── terraform/            # AWS/EC2 provisioning (production)
├── skills/                   # Agent skill documents (soul.md + 10 SKILL.md)
├── .the-dev-team/            # Runtime state, history, config
├── Taskfile.yml              # Root task runner
└── .env                      # Local environment config
```

## K8s Namespaces

| Namespace | What's in it |
|-----------|-------------|
| `app` | Main application (backend, frontend, database, keycloak, docs) |
| `the-dev-team` | Agent backend + frontend |
| `env-*` | Sandbox environments (ephemeral, created per worktree) |
| `dns` | CoreDNS for Split DNS |
| `traefik` | Ingress controller |
| `registry` | In-cluster container registry |
