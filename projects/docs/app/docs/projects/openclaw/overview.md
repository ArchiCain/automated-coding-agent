# OpenClaw Gateway

Autonomous coding agent powered by OpenClaw + Claude Code ACP. Deployed to the `openclaw` K8s namespace.

## Architecture

```
Mac Mini K3s Cluster
│
├── app namespace (existing, unchanged)
│   ├── database, backend, frontend, keycloak, docs
│
└── openclaw namespace
    └── openclaw-gateway (Deployment)
        ├── OpenClaw Gateway daemon (orchestration)
        ├── Built-in Web UI (chat, monitoring)
        ├── Claude Code CLI (ACP sessions)
        ├── Playwright + headless Chromium (E2E testing)
        ├── git, go-task, gh CLI
        ├── Skills (SKILL.md files)
        ├── Secrets from K8s Secret
        ├── Workspace PVC (50Gi)
        └── Ingress: openclaw.mac-mini
```

## What It Does

OpenClaw receives work through three channels:

1. **GitHub webhooks** — push and PR events trigger agent responses
2. **Cron schedules** — periodic CI monitoring, E2E validation, backlog catchup
3. **Web UI** — operator sends messages directly via the browser dashboard

The Gateway orchestrates Claude Code ACP sessions to write code, create PRs, and run tests. Skills define the agent's capabilities (decomposition, execution, monitoring, E2E testing, GitHub operations).

## Project Structure

```
projects/openclaw/
├── app/
│   ├── openclaw.json           # Gateway configuration
│   ├── SOUL.md                 # Agent identity and behavioral rules
│   └── skills/
│       ├── rlm-decompose/      # Plan → task tree decomposition
│       ├── rlm-execute/        # Task implementation via Claude Code
│       ├── rlm-github/         # GitHub operations (PRs, issues)
│       ├── rlm-monitor/        # CI pipeline monitoring
│       └── rlm-e2e-tester/     # Playwright E2E validation
├── dockerfiles/
│   ├── prod.Dockerfile         # Nix-based image
│   ├── flake.nix               # Nix dev shell
│   └── entrypoint.sh           # Git credentials + startup
├── chart/                      # Helm chart for K8s deployment
├── Taskfile.yml
└── README.md
```

## Configuration

| Variable | Purpose | Required |
|----------|---------|----------|
| `ANTHROPIC_API_KEY` | LLM provider for Gateway orchestration | Yes |
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude Code ACP sessions | Yes |
| `GITHUB_TOKEN` | Git operations and GitHub API | Yes |
| `OPENCLAW_WEBHOOK_SECRET` | GitHub webhook authentication | Yes |
| `OPENCLAW_AUTH_TOKEN` | Web UI authentication | Yes |
| `OPENCLAW_PORT` | Gateway port (default: 18789) | No |
| `OPENCLAW_HOST` | Ingress hostname (default: openclaw.mac-mini) | No |
| `OPENCLAW_NAMESPACE` | K8s namespace (default: openclaw) | No |
| `OPENCLAW_WORKSPACE_SIZE` | PVC size (default: 50Gi) | No |

## Access

- **Deployed**: `https://openclaw.mac-mini` (via Tailscale)
- **Local dev**: `http://localhost:18789`

## Skills

### rlm-decompose
Breaks feature plans into implementable task trees following the project/feature/concern hierarchy.

### rlm-execute
Implements atomic tasks by writing code in Claude Code ACP sessions, running tests, and creating PRs.

### rlm-github
Manages GitHub operations: PRs, issues, labels, reviews. Used by other skills.

### rlm-monitor
Watches CI pipelines on open PRs every 5 minutes. Diagnoses failures and pushes fixes or creates issues.

### rlm-e2e-tester
Runs Playwright E2E tests against the deployed application every 10 minutes. Validates merged changes, creates issues with screenshots on failure.

## Cron Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| `monitor-ci` | Every 5 min | Check CI on open implementation PRs |
| `e2e-check` | Every 10 min | Run E2E tests on recently merged PRs |
| `catchup-scan` | Every 15 min | Find approved plans with unexecuted tasks |

## Common Tasks

```bash
task openclaw:local:start       # Start via Docker Compose
task openclaw:local:stop        # Stop the service
task openclaw:local:logs        # Follow logs
task openclaw:local:health      # Check health endpoint
task openclaw:remote:build      # Build image on K8s node
task openclaw:remote:deploy     # Full build + deploy
task openclaw:k8s:status        # Show pod status
task openclaw:k8s:logs          # Follow pod logs
task openclaw:k8s:shell         # Shell into the pod
```

## E2E Testing

The OpenClaw pod includes Playwright + headless Chromium. It can run E2E tests against the live deployed application because it shares the K8s cluster:

```bash
# Via K8s DNS (recommended)
E2E_BASE_URL=http://frontend.app.svc.cluster.local:8080 npx playwright test

# Via Traefik ingress (full path)
E2E_BASE_URL=http://app.mac-mini npx playwright test
```

## What This Replaces

| Old (coding-agent) | New (openclaw) |
|---------------------|----------------|
| coding-agent-backend (NestJS, 50+ files) | OpenClaw Gateway (~15 config files) |
| coding-agent-frontend (Angular app) | Built-in Web UI (ships with Gateway) |
| Custom session management, job queue | OpenClaw Gateway + skills |
| Custom WebSocket gateways | OpenClaw Web UI live chat |
| `coding-agent` K8s namespace | `openclaw` K8s namespace |
