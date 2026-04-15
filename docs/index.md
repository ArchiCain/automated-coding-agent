# THE Dev Team

An autonomous coding agent that runs in Kubernetes. You chat with a Claude Code agent through a web UI, and it can read/write code, manage git branches, deploy sandbox environments, and create PRs -- all through structured MCP tools (no arbitrary bash access).

## Architecture

```
projects/the-dev-team/
├── backend/         # NestJS API + Claude Code SDK + MCP tools
└── frontend/        # React chat UI + DevOps dashboard + docs viewer
```

Both services run in K8s in the `the-dev-team` namespace. The agent operates on a cloned copy of the repo at `/workspace` inside the backend pod (PVC-backed).

## How it works

1. User sends a message in the chat UI (React frontend)
2. Frontend sends it via WebSocket to the backend
3. Backend passes it to the Claude Code SDK `query()` function with a system prompt and an allowlist of tools
4. Claude Code runs its agent loop, calling tools via the MCP server (spawned as a subprocess)
5. MCP server handles git operations and sandbox deployment through structured tool calls
6. Messages stream back to the frontend via WebSocket

**No Bash access.** The agent cannot run arbitrary commands. Every operation is a structured tool call.

### Available tools

Claude Code has access to:

- **File ops** (built-in): Read, Write, Edit, Glob, Grep
- **Git** (MCP): git_status, git_diff, git_log, git_checkout, git_add, git_commit, git_push, git_pull, git_stash, git_branch
- **Workspace** (MCP): create_worktree, deploy_sandbox, destroy_sandbox, list_sandboxes, sandbox_status, sandbox_logs, push_and_pr

## Quick start

```bash
# 1. Enter the Nix dev shell (installs all tools)
cd automated-coding-agent
direnv allow

# 2. Configure environment
cp .env.template .env
# Fill in DEV_HOSTNAME, TAILSCALE_IP, and credentials (see docs/getting-started/)

# 3. Start everything
task up
```

`task up` starts Minikube, builds all images, and deploys via Helmfile. With the Tailscale gateway configured (see [Environment Setup](getting-started/environment-setup.md)), services are available at:

| Service | URL |
|---------|-----|
| THE Dev Team chat UI | `http://devteam.{DEV_HOSTNAME}` |
| THE Dev Team API | `http://agent-api.{DEV_HOSTNAME}` |
| Application frontend | `http://app.{DEV_HOSTNAME}` |
| Application API | `http://api.{DEV_HOSTNAME}` |
| Keycloak | `http://auth.{DEV_HOSTNAME}` |

Key commands:

| Command | Purpose |
|---------|---------|
| `task up` | Start Minikube, build images, deploy everything |
| `task status` | Show cluster status |
| `task reset:up` | Full reset and redeploy from scratch |

## Repo structure

```
automated-coding-agent/
├── projects/
│   ├── application/              # Main product
│   │   ├── backend/              # NestJS API
│   │   ├── frontend/             # React SPA
│   │   ├── database/             # PostgreSQL + pgvector
│   │   ├── keycloak/             # Auth service
│   │   └── e2e/                  # Playwright tests
│   └── the-dev-team/             # THE Dev Team (autonomous coding agent)
│       ├── backend/              # Agent backend (NestJS + Claude Code SDK)
│       └── frontend/             # Chat UI + DevOps dashboard
├── infrastructure/
│   ├── k8s/                      # Helmfile, charts, environments
│   ├── agent-envs/               # Taskfile for sandbox lifecycle
│   ├── minikube/                 # Local cluster setup
│   └── terraform/                # AWS/EC2 provisioning
├── flake.nix                     # Nix dev shell (includes tmux)
└── Taskfile.yml                  # Root task automation
```

## K8s namespaces

| Namespace | Contents |
|-----------|----------|
| `app` | Main application (backend, frontend, database, keycloak) |
| `the-dev-team` | Agent backend + frontend |
| `env-*` | Sandbox environments (ephemeral, created per worktree) |
| `tailscale` | Tailscale gateway (local dev only — gives minikube a tailnet IP) |
| `dns` | CoreDNS for Tailscale Split DNS (remote servers only) |
| `traefik` | Ingress controller |
| `registry` | In-cluster container registry |
| `monitoring` | Prometheus, Grafana, Loki, Promtail |

## Where to go next

- **Setting up a machine?** Start with [Prerequisites](getting-started/prerequisites.md) and [Environment Setup](getting-started/environment-setup.md).
- **Running it locally?** See [Local Workflow](development/local-workflow.md).
- **Understanding the projects?** Read the [Projects Overview](projects/overview.md).
- **Want architecture details?** The [Backend](projects/the-dev-team/backend.md) and [Frontend](projects/the-dev-team/frontend.md) docs cover the agent internals.
