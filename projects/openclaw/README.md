# OpenClaw Gateway

Autonomous coding agent powered by OpenClaw + Claude Code ACP. Replaces the coding-agent backend and frontend with a single Gateway that includes a built-in Web UI.

## Architecture

```
openclaw-gateway (K8s namespace: openclaw)
    ├── OpenClaw Gateway daemon (orchestration, webhooks, cron)
    ├── Built-in Web UI (chat, monitoring, configuration)
    ├── Claude Code CLI (ACP sessions for coding tasks)
    ├── Playwright + headless Chromium (E2E testing)
    ├── Skills (decompose, execute, github, monitor, e2e-tester)
    └── Workspace PVC (50Gi for repo clones)
```

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
├── Taskfile.yml                # Local dev and deploy tasks
└── README.md
```

## Configuration

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | OpenClaw Gateway LLM provider |
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude Code ACP sessions |
| `GITHUB_TOKEN` | Git operations and GitHub API |
| `OPENCLAW_WEBHOOK_SECRET` | GitHub webhook authentication |
| `OPENCLAW_AUTH_TOKEN` | Web UI authentication |
| `OPENCLAW_PORT` | Gateway port (default: 18789) |
| `OPENCLAW_HOST` | Ingress hostname (default: openclaw.mac-mini) |

## Access

- **Deployed**: `https://openclaw.mac-mini` (via Tailscale)
- **Local dev**: `http://localhost:18789`

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

## What This Replaces

| Old (coding-agent) | New (openclaw) |
|---------------------|----------------|
| coding-agent-backend (NestJS, 50+ files) | OpenClaw Gateway (~15 config files) |
| coding-agent-frontend (Angular app) | Built-in Web UI (ships with Gateway) |
| Custom session management, job queue | OpenClaw Gateway + skills |
| Custom WebSocket gateways | OpenClaw Web UI live chat |
| coding-agent K8s namespace | openclaw K8s namespace |
