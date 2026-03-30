# Coding Agent Backend

NestJS service for the autonomous coding agent — plan management, AI-powered decomposition, task execution, and Claude Code SDK integration.

## Architecture

```
coding-agent-frontend (Angular on :3001)
    ↓ REST + WebSocket
coding-agent-backend (NestJS on :8086)
    ↓ Claude Code SDK + File System + Git
.coding-agent-data/ (agents + backlog)
```

## Project structure

```
projects/coding-agent/backend/
├── app/
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   └── features/
│   │       ├── backlog/                 # Plan CRUD from .coding-agent-data/backlog/
│   │       ├── claude-code-agent/       # Core agent feature (controllers, services, gateways, providers)
│   │       ├── command-center/          # Git + Docker orchestration
│   │       ├── cors/                    # CORS configuration
│   │       ├── health/                  # Health check endpoint
│   │       ├── job-queue/               # Background job processing with workers
│   │       ├── projects/               # Repo project/feature scanner
│   │       ├── shared/claude-cli/       # Claude CLI wrapper service
│   │       └── task-runner/             # Task CLI execution + WebSocket streaming
│   ├── jest.config.js
│   └── jest.integration.config.js
├── dockerfiles/
│   └── prod.Dockerfile
├── chart/
└── Taskfile.yml
```

## Features

| Feature | Purpose |
|---------|---------|
| **backlog** | Plan CRUD from `.coding-agent-data/backlog/` (p-* directories) |
| **claude-code-agent** | Core feature: 9 controllers (agents, brainstorming, decomposition, environment, execution, filesystem, prompts, review, sessions), WebSocket gateways, multi-provider support (Claude Code + OpenCode) |
| **command-center** | Git status monitoring, Docker service management |
| **job-queue** | Background job processing with auto-decomp worker |
| **projects** | Scans `projects/` directory, detects project types and feature structures |
| **shared/claude-cli** | Claude CLI wrapper service |
| **task-runner** | Spawns Taskfile commands as child processes, streams output via WebSocket |

## Data storage

Runtime data lives in `.coding-agent-data/` at the repo root:

- **`agents/`** — Agent configs (config.json, instructions.md, sessions/)
- **`backlog/`** — Plans (p-* directories with plan.md, state.json, tasks/)

## Configuration

| Variable | Description |
|----------|-------------|
| `CODING_AGENT_BACKEND_PORT` | Local port (default: 8086) |
| `ANTHROPIC_API_KEY` | Required for Claude decomposition |
| `CLAUDE_CODE_OAUTH_TOKEN` | For Claude Code SDK sessions |
| `GITHUB_TOKEN` | For git operations |
| `REPO_ROOT` | Root path for file operations |

## Common tasks

```bash
task coding-agent-backend:local:start           # Dev server on port 8086
task coding-agent-backend:local:build           # Compile TypeScript
task coding-agent-backend:local:test            # Unit tests
task coding-agent-backend:local:test:integration # Integration tests
task coding-agent-backend:local:lint            # ESLint
task coding-agent-backend:remote:build          # Build Docker image on K8s node
task coding-agent-backend:remote:deploy         # Full helmfile deployment
```

## Tech stack

NestJS 11, TypeScript 5.9, Claude Code SDK 2.1, Claude Agent SDK 0.2, Socket.io 4.8, EventEmitter2, Zod 4.3, Jest 30.
