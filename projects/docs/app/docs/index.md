# Automated Repo

A monorepo for building AI-powered applications, driven by **THE Dev Team** — an autonomous multi-role development system that implements, tests, reviews, and ships its own code.

## What's in this repo

Three project groups share infrastructure, tooling, and deployment patterns:

| Group | Purpose | Services |
|-------|---------|----------|
| **Application** | The main product | Backend (NestJS), Frontend (React), Database (PostgreSQL + pgvector), Keycloak |
| **THE Dev Team** | Autonomous development system | Orchestrator (NestJS), Dashboard (React + MUI), shared `skills/` library |
| **Docs** | This documentation site | MkDocs Material |

All services run on Kubernetes from day one. **Minikube** is the local target; **K3s** is the production target. Same topology, same charts.

## THE Dev Team in one minute

Instead of a single-agent gateway, THE Dev Team is a role-based orchestrator:

- A task arrives (REST, GitHub issue, or a decomposed plan)
- The orchestrator assigns an **agent slot**, creates an isolated git worktree and a sandbox K8s namespace (`env-{task-id}`)
- It runs a **7-phase execution loop** (setup -> implement -> build+deploy -> test -> review+fix -> submit -> cleanup)
- Along the way it dispatches work to nine specialised **roles** (architect, implementer, reviewer, tester, designer, bugfixer, documentarian, monitor, devops) using prompts assembled from `skills/soul.md` plus role-specific `SKILL.md` files
- Every phase runs through **validation gates** (build, unit tests, deployment, integration, log audit, e2e, accessibility, design review, performance)
- When all gates pass, the agent opens a PR with evidence (tests, screenshots, metrics)
- A **human** merges — the agent never pushes to `main`

The [Dashboard](projects/coding-agent/dashboard.md) gives you live visibility into every active task. The [Task State & History](projects/coding-agent/backlog.md) system records every session as JSONL transcripts and markdown summaries, synced to a protected git branch.

Start here: [THE Dev Team Overview](the-dev-team/overview.md).

## Quick start

```bash
# 1. Enter the Nix dev shell (installs all tools)
cd automated-coding-agent
direnv allow

# 2. Configure environment
cp .env.template .env
# Edit .env with your credentials

# 3. Set up K8s secrets (first time only)
task setup-secrets

# 4. Start everything (Minikube + build + deploy)
task up

# 5. In a separate terminal, enable ingress access
task minikube:tunnel
```

Default local URLs:

| Service | URL |
|---------|-----|
| Dashboard | http://dashboard.localhost |
| Orchestrator API | http://agent-api.localhost |
| Application frontend | http://app.localhost |
| Application API | http://api.localhost |
| Keycloak | http://auth.localhost |
| Docs | http://docs.localhost |

See [Environment Setup](getting-started/environment-setup.md) for the full `.env` reference.

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
│   ├── coding-agent/             # THE Dev Team
│   │   ├── backend/              # Orchestrator (NestJS)
│   │   └── dashboard/            # Observability dashboard (React + MUI)
│   └── docs/                     # This documentation site
├── skills/                       # soul.md + 10 role skills
├── .the-dev-team/                # Runtime state, history, baselines, config
├── infrastructure/
│   ├── agent-envs/               # env:* Taskfile (sandbox lifecycle)
│   ├── history/                  # history:* Taskfile
│   ├── minikube/                 # minikube:* Taskfile
│   ├── k8s/
│   │   └── charts/
│   │       ├── full-stack/       # Umbrella chart for sandbox envs
│   │       └── the-dev-team/     # Orchestrator RBAC + secrets
│   ├── docker/                   # Docker Compose (deprecated)
│   └── terraform/                # EC2 + K3s provisioning
├── flake.nix                     # Nix dev shell
└── Taskfile.yml                  # Root task automation
```

## Where to go next

- **Just browsing?** Read [THE Dev Team Overview](the-dev-team/overview.md).
- **Setting up a machine?** Start with [Prerequisites](getting-started/prerequisites.md) and [Environment Setup](getting-started/environment-setup.md).
- **Running it locally?** See [Local Workflow](development/local-workflow.md).
- **Submitting a task?** Jump to [Submitting Tasks](the-dev-team/submitting-tasks.md).
- **Want to understand the architecture?** The [Orchestrator](projects/coding-agent/backend.md), [Execution Loop](the-dev-team/execution-loop.md), and [Validation Gates](the-dev-team/validation-gates.md) docs are the core.
