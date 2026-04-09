# THE Dev Team Orchestrator

The NestJS service that drives the entire autonomous development system — task intake, agent pool management, sandbox environment lifecycle, the 7-phase execution loop, validation gates, PR submission, history recording, and the real-time dashboard gateway.

Source: `projects/coding-agent/backend/` (the directory name predates the rename from the legacy coding-agent backend).

## Purpose

The orchestrator is the brain of THE Dev Team. It:

- Receives tasks from REST, GitHub issues, decomposition, PR feedback, or CI failures
- Assigns each task to an **agent slot**, creates an isolated git worktree and a sandbox K8s namespace
- Runs a deterministic execution loop that dispatches work to **nine roles**
- Uses a pluggable provider abstraction to actually run the role (Claude Code today, OpenCode tomorrow)
- Runs a fixed sequence of **validation gates** between phases, retrying failures with the bugfixer role
- Submits a PR with structured evidence when every gate passes
- Records everything to `.the-dev-team/history/` as JSONL transcripts and markdown summaries
- Streams progress over WebSocket to the [Dashboard](dashboard.md)

Humans still merge PRs — the orchestrator cannot push to protected branches. See [Safety Model](../../the-dev-team/safety-model.md).

## Roles

Every task is executed by multiple roles in sequence. Each role has a specific purpose, a curated set of skills, and a restricted toolset.

| Role | Purpose | Allowed tools |
|------|---------|---------------|
| **architect** | Analyse the codebase, produce a plan, decompose into a task tree | Read, Grep, Glob |
| **implementer** | Write the code from the architect's plan | Read, Write, Edit, Bash, Grep, Glob |
| **reviewer** | Review the full diff, write findings markdown | Read, Write, Grep, Glob |
| **tester** | Write and run unit + integration tests against the live sandbox | Read, Write, Edit, Bash, Grep, Glob |
| **designer** | Implement frontend UI, write Playwright E2E, capture screenshots, enforce the design system | Read, Write, Edit, Bash, Grep, Glob |
| **bugfixer** | Read gate failures + reviewer findings and fix them | Read, Write, Edit, Bash, Grep, Glob |
| **documentarian** | Update docs to reflect the change | Read, Write, Edit, Grep, Glob |
| **monitor** | Monitor CI pipelines after merge, file issues on regressions | Read, Bash, Grep |
| **devops** | Run `task env:*` commands to build, deploy, and inspect sandboxes | Bash, Read |

The mapping from roles to skills and tools lives in the skill loader. See [Roles & Skills](../../the-dev-team/roles-and-skills.md).

## Module structure

The orchestrator is a NestJS application organised into well-bounded modules:

```
projects/coding-agent/backend/app/src/
├── main.ts
├── app.module.ts
├── core/                  # Orchestration primitives
│   ├── orchestrator.module.ts
│   ├── task-intake.service.ts       # Tasks from REST, GitHub, decomposition
│   ├── agent-pool.service.ts        # Concurrent agent slots
│   ├── environment-manager.service.ts  # K8s namespace lifecycle
│   ├── session-manager.service.ts   # Agent session state, resume
│   ├── pr-manager.service.ts        # PR create / update / comment
│   └── scheduler.service.ts         # Cron jobs
├── agents/                # Execution loop + gates
│   ├── execution-loop.service.ts    # The 7 phases
│   ├── role-dispatcher.service.ts   # Runs a role via a provider
│   └── gates/                       # GateRunner + all gate implementations
├── providers/             # Pluggable coding-agent providers
│   ├── coding-agent-provider.interface.ts
│   ├── claude-code.provider.ts
│   ├── opencode.provider.ts         # Stub
│   └── provider-registry.service.ts
├── skills/                # Skill loader service
│   └── skill-loader.service.ts
├── state/                 # Per-task state & findings
│   ├── task-state.service.ts        # .the-dev-team/state/{task-id}/
│   └── findings.service.ts
├── history/               # Transcripts, summaries, history sync
│   ├── transcript-writer.service.ts
│   ├── task-summary.service.ts
│   └── history-sync.service.ts
├── config/                # the-dev-team.config.yml loader
│   └── dev-team-config.service.ts
├── gateway/               # WebSocket
│   ├── dashboard.gateway.ts         # Namespace: /dashboard
│   └── agent-stream.gateway.ts
└── shared/                # Git, Helm, Docker, generic Taskfile runner
    ├── git.service.ts
    ├── helm.service.ts
    ├── docker.service.ts
    └── taskfile.service.ts
```

## The 7-phase execution loop

Every task flows through these phases sequentially. See [Execution Loop](../../the-dev-team/execution-loop.md) for the full mechanics.

1. **Setup** — fetch origin, create worktree + branch `the-dev-team/{kind}/{task-id}`
2. **Implement** — architect produces a plan, implementer writes code
3. **Build + Deploy** — `build` and `unit-tests` gates run; devops deploys a sandbox via `task env:create`
4. **Test** — tester writes integration tests; designer adds Playwright + design review if `touchesFrontend`; gate sequence runs
5. **Review + Fix** — reviewer writes findings; bugfixer loops until findings are resolved or retry budget is exhausted
6. **Submit** — commit, push, `pr-manager` creates a structured PR
7. **Cleanup** — optionally destroy the sandbox, remove the worktree, mark the task completed

Failed gates trigger the bugfixer with a per-gate retry budget (default 3). When the budget is exhausted the task is **escalated** to a human.

## REST API

| Endpoint | Purpose |
|----------|---------|
| `POST /api/tasks` | Submit a new task |
| `GET /api/tasks` | List tasks with filters (`status`, `source`, …) |
| `GET /api/tasks/:id` | Get a single task with state, findings, gate results |
| `DELETE /api/tasks/:id` | Cancel a running task |
| `GET /api/agents` | List all agent slots and their current state |
| `GET /api/agents/:id/stream` | SSE stream of a running role |
| `GET /api/environments` | List active sandbox namespaces |
| `GET /api/environments/:taskId/health` | Health check for a sandbox |
| `DELETE /api/environments/:taskId` | Force-destroy a sandbox |
| `GET /api/history/tasks?q=...` | Search task summaries |
| `GET /api/history/sessions/:taskId` | List session transcripts for a task |

See [Submitting Tasks](../../the-dev-team/submitting-tasks.md) for request/response examples.

## WebSocket gateway

The orchestrator exposes a `/dashboard` namespace via `socket.io` for real-time events consumed by the [Dashboard](dashboard.md):

| Event | Payload |
|-------|---------|
| `agent:progress` | `{ taskId, role, message }` — streamed agent messages |
| `task:update` | `{ task }` — status changes |
| `env:health` | `{ taskId, health }` — sandbox health results |
| `gate:result` | `{ taskId, result }` — gate pass/fail with details |

## Configuration

The orchestrator loads its runtime configuration from `.the-dev-team/config/the-dev-team.config.yml`:

```yaml
maxConcurrent: 4
retryBudget: 3
keepEnvironmentForReview: true

default:
  provider: claude-code

roles:
  architect:   { provider: claude-code, model: claude-opus-4-6 }
  implementer: { provider: claude-code, model: claude-sonnet-4 }
  designer:    { provider: claude-code, model: claude-opus-4-6 }  # Vision required
  # ... other roles fall back to default
```

See [Configuration](../../the-dev-team/configuration.md) for the full schema.

## Provider abstraction

Roles never call Claude Code directly. They go through a `CodingAgentProvider` interface:

```typescript
export interface CodingAgentProvider {
  name: string;
  execute(options: ExecuteOptions): AsyncIterable<AgentMessage>;
}
```

Two implementations exist:

- **`claude-code.provider.ts`** — primary, wraps `@anthropic-ai/claude-agent-sdk` and `@anthropic-ai/claude-code`
- **`opencode.provider.ts`** — stub for a future open-source alternative

The `ProviderRegistryService` picks a provider per role from the config file, so different roles can use different models/providers without any code changes.

## Common tasks

```bash
task coding-agent-backend:local:start            # Dev server
task coding-agent-backend:local:build            # Compile TypeScript
task coding-agent-backend:local:test             # Unit tests
task coding-agent-backend:local:test:integration # Integration tests (against running stack)
task coding-agent-backend:local:lint             # ESLint
task coding-agent-backend:remote:build           # Build Docker image (Minikube)
task coding-agent-backend:remote:deploy          # Deploy to the the-dev-team namespace
```

## Tech stack

NestJS 11, TypeScript 5.9, `@anthropic-ai/claude-agent-sdk` 0.2, `@anthropic-ai/claude-code` 2.1, `@nestjs/websockets` + Socket.io 4.8, `@nestjs/schedule`, EventEmitter2, Zod 4.3, Jest 30.

## Related reading

- [Execution Loop](../../the-dev-team/execution-loop.md)
- [Validation Gates](../../the-dev-team/validation-gates.md)
- [Sandbox Environments](../../the-dev-team/sandbox-environments.md)
- [Task State & History](backlog.md)
- [Configuration](../../the-dev-team/configuration.md)
