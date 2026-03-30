# Coding Agent Backend

NestJS service for the autonomous coding agent system — plan management, AI-powered decomposition, task execution, and Claude Code SDK integration.

## Project Structure

```
projects/coding-agent/backend/
├── app/
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   └── features/
│   │       ├── backlog/                 # Plan CRUD from .coding-agent-data/backlog/
│   │       ├── claude-code-agent/       # Core agent feature (see below)
│   │       ├── command-center/          # Git + Docker orchestration dashboard
│   │       ├── cors/                    # CORS configuration
│   │       ├── health/                  # Health check endpoint
│   │       ├── job-queue/               # Background job processing with workers
│   │       ├── projects/               # Repo project/feature scanner
│   │       ├── shared/claude-cli/       # Claude CLI wrapper service
│   │       └── task-runner/             # Task CLI execution + WebSocket streaming
│   ├── jest.config.js
│   └── jest.integration.config.js
├── dockerfiles/
│   └── prod.Dockerfile                 # Nix-based build (must build on target arch)
├── chart/                               # Helm chart for K8s
└── Taskfile.yml
```

### claude-code-agent feature

The largest feature module, containing the core agent functionality:

```
features/claude-code-agent/
├── controllers/
│   ├── agents.controller.ts          # Agent config CRUD
│   ├── brainstorming.controller.ts   # Plan brainstorming sessions
│   ├── decomposition.controller.ts   # Feature → task decomposition
│   ├── environment.controller.ts     # Dev environment management
│   ├── execution.controller.ts       # Task execution orchestration
│   ├── filesystem.controller.ts      # File read/write API
│   ├── prompts.controller.ts         # Prompt template management
│   └── review.controller.ts          # Code review sessions
├── core/
│   └── base-agent.ts                 # Base agent abstraction
├── gateway/
│   ├── session.gateway.ts            # WebSocket session streaming
│   └── environment.gateway.ts        # WebSocket env status updates
├── providers/
│   ├── agent-provider.interface.ts   # Agent provider contract
│   ├── claude-code.provider.ts       # Claude Code SDK provider
│   ├── opencode.provider.ts          # OpenCode provider
│   └── agent-provider-registry.ts    # Provider registry
└── services/
    ├── agents.service.ts             # Agent config CRUD (.coding-agent-data/agents/)
    ├── brainstorming.service.ts      # Plan creation and brainstorming
    ├── decomposition.service.ts      # AI decomposition engine (37KB)
    ├── environment.service.ts        # Dev environment lifecycle (26KB)
    ├── execution.service.ts          # Task execution orchestration
    ├── prompts.service.ts            # Prompt template management
    ├── review.service.ts             # Code review with Claude
    └── session.service.ts            # Claude Code session management (17KB)
```

## Data Storage

Runtime data lives in `.coding-agent-data/` at the repo root:

- **`.coding-agent-data/agents/`** — Agent configurations (config.json, instructions.md, sessions/)
- **`.coding-agent-data/backlog/`** — Plans (p-* directories with plan.md, state.json, tasks/)

## Tasks

```bash
task coding-agent-backend:local:start           # Dev server on port 8086
task coding-agent-backend:local:build           # Compile TypeScript
task coding-agent-backend:local:test            # Unit tests
task coding-agent-backend:local:test:integration # Integration tests
task coding-agent-backend:local:lint            # ESLint
task coding-agent-backend:local:format          # Prettier
task coding-agent-backend:remote:build          # Build Docker image on K8s node
task coding-agent-backend:remote:deploy         # Full helmfile deployment
```

## Configuration

| Variable | Description |
|----------|-------------|
| `CODING_AGENT_BACKEND_PORT` | Local port (default: 8086) |
| `ANTHROPIC_API_KEY` | Required for Claude decomposition |
| `CLAUDE_CODE_OAUTH_TOKEN` | For Claude Code SDK sessions |
| `GITHUB_TOKEN` | For git operations |
| `REPO_ROOT` | Root path for file operations |

## Tech Stack

NestJS 11, TypeScript 5.9, Claude Code SDK 2.1, Claude Agent SDK 0.2, Socket.io 4.8, EventEmitter2, Zod 4.3, Jest 30.
