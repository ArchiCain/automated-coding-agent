# THE Dev Team -- Backend

The agent backend lives at `projects/the-dev-team/backend/`. It manages chat sessions, orchestrates autonomous agent workflows, streams messages over WebSocket, integrates with the Claude Code SDK, and provides cluster introspection endpoints.

## Stack

- **NestJS 11** -- API framework
- **Claude Code SDK** (`@anthropic-ai/claude-agent-sdk`) -- AI provider (default model: `claude-opus-4-6`)
- **MCP Server** (`@modelcontextprotocol/sdk`) -- Structured tool access for git, workspace, GitHub, and Playwright operations
- **Kubernetes client** (`@kubernetes/client-node`) -- Cluster introspection
- **EventEmitter** (`@nestjs/event-emitter`) -- Decouples task-runner service from WebSocket gateway

## Architecture overview

The backend serves two audiences:

1. **Interactive (UI)** -- Users chat with agents via WebSocket. Messages flow: frontend → AgentGateway → AgentService → ClaudeCodeProvider → Claude Code SDK → MCP tools → response stream.
2. **Autonomous (Router)** -- The RouterService polls GitHub every 30s and spawns headless agent sessions via `agentService.runMessage()`. No socket required.

## Agent roles

Each role defines which tools are available, which MCP servers to connect, and the system prompt. Roles are registered in `roles/role-registry.ts`.

| Role | File | Tools | MCP Servers |
|------|------|-------|-------------|
| `designer` | `designer.role.ts` | Playwright browser, GitHub Issues, PR review | playwright, github_issues, workspace |
| `frontend-owner` | `frontend-owner.role.ts` | File ops (Read/Write/Edit/Glob/Grep), git, sandbox, PR | workspace |
| `default` | `default.role.ts` | File ops, git, sandbox, PR | workspace |

The `ClaudeCodeProvider` reads the role's `allowedTools`, `disallowedTools`, and `mcpServers` and passes them to the Claude Code SDK `query()` call.

**Important SDK distinction:** `allowedTools` only auto-approves (no user prompt); `disallowedTools` removes tools from the model's context entirely. Both must be set to properly restrict a role.

## Router service (orchestration)

`RouterService` (`features/router/`) is the autonomous orchestration engine. It polls GitHub every 30 seconds and triggers agent actions:

| Trigger | Action |
|---------|--------|
| New open issue with `frontend` label | Spawn Frontend Owner with "pick up #N" |
| New draft PR authored by the bot | Spawn Designer with "review PR #M" |
| New CHANGES_REQUESTED review on bot's PR | Spawn FE Owner with "address review on #M" |
| New commits on draft PR after Designer reviewed | Spawn Designer to re-review |
| PR closed/merged (bot-authored) | Destroy sandbox + remove worktree |

State is persisted to `$REPO_ROOT/.dev-team/router/state.json` so triggers aren't re-fired after a restart.

**Dedup logic:** Before routing an issue, the router checks if any open PR already references it via `closingIssuesReferences`. This prevents duplicate spawns after a state reset.

## MCP servers

Three MCP servers run as stdio subprocesses of Claude Code SDK:

### Workspace MCP (`mcp-server.ts`)

Used by all roles. Provides 20+ tools:

**Git tools:** `git_status`, `git_diff`, `git_log`, `git_checkout`, `git_add`, `git_commit`, `git_push`, `git_pull`, `git_stash`, `git_branch`

**Workspace tools:** `create_worktree`, `deploy_sandbox`, `destroy_sandbox`, `list_sandboxes`, `sandbox_status`, `sandbox_logs`

**PR/Issue tools:** `push_and_pr`, `read_github_issue`, `comment_github_issue`, `read_pr_reviews`, `review_pr`, `comment_pr`, `mark_pr_ready`

All commands run via `execFile` (not a shell) against `/workspace`. Sandbox tools delegate to `task env:*`. Git auth is handled by reading `/workspace/.git-credentials` before every command (ensures fresh GitHub App token).

### GitHub Issues MCP (`github-issues-mcp.ts`)

Designer-only. Provides `create_github_issue` with required fields: title, body, labels, environmentReviewed, reviewedUrl.

### Playwright CDP MCP (`playwright-cdp-launcher.ts`)

Designer-only. Wraps the Playwright MCP server and connects to a headless Chrome sidecar via Chrome DevTools Protocol (`ws://headless-chrome:9222`). The sidecar runs `zenika/alpine-chrome` in the `the-dev-team` namespace.

## Task runner

`TaskRunnerModule` (`features/task-runner/`) accepts Taskfile task names, spawns them as child processes, and streams output over WebSocket.

- **REST:** `POST /task-runner/tasks` (start), `GET /task-runner/tasks` (list), `GET /task-runner/tasks/:id` (detail), `POST /task-runner/tasks/:id/cancel`
- **WebSocket namespace:** `/task-runner` with events `task:output`, `task:status`, `task:list`
- **Security:** Whitelist of allowed task names; rejects anything not in `ALLOWED_TASKS`
- Uses NestJS EventEmitter to decouple service from gateway

## Cluster introspection

The `ClusterService` connects to the K8s API and exposes REST endpoints for:

- Pod listing with status, ports, CPU/memory usage
- Service listing per namespace
- Pod log streaming
- Prometheus metrics proxy (CPU, memory, network, request rates)
- Loki log search proxy

These power the frontend's DevOps dashboard and environment pages.

## GitHub App authentication

`GithubTokenService` generates installation tokens from a GitHub App private key. Tokens have a 1-hour TTL and are auto-refreshed every 50 minutes via `setInterval`. The token is written to `/workspace/.git-credentials` (used by git credential helper) and to `$REPO_ROOT/.dev-team/github-token` (used by MCP servers).

MCP servers always re-read `.git-credentials` before every git/gh command to ensure they use a fresh token. This avoids stale token issues when long-running agent sessions outlive a single token.

## Key source files

| File | Purpose |
|------|---------|
| `app/src/main.ts` | Entry point -- loads .env, bootstraps NestJS |
| `app/src/app.module.ts` | Root module: Health, CORS, Agent, Cluster, TaskRunner, Router |
| `app/src/features/agent/agent.service.ts` | Session CRUD, `runMessage()` for headless invocation, provider dispatch |
| `app/src/features/agent/agent.gateway.ts` | WebSocket gateway -- streams messages to frontend |
| `app/src/features/agent/agent.controller.ts` | REST: create/list/delete sessions, list roles |
| `app/src/features/agent/normalize-message.ts` | Claude SDK message → normalized frontend format |
| `app/src/features/agent/github-token.service.ts` | GitHub App token lifecycle (auto-refresh) |
| `app/src/features/agent/providers/claude-code.provider.ts` | Claude Code SDK integration, MCP config, tool restrictions |
| `app/src/features/agent/roles/*.role.ts` | Role definitions (tools, MCP servers, system prompts) |
| `app/src/features/agent/roles/role-registry.ts` | Role lookup by name |
| `app/src/features/router/router.service.ts` | Orchestration: poll GitHub → spawn agents → cleanup |
| `app/src/features/router/router.types.ts` | RouterState, IssueSummary, PrSummary, ClosedPrSummary |
| `app/src/features/task-runner/task-runner.service.ts` | Taskfile execution, output streaming |
| `app/src/features/task-runner/task-runner.gateway.ts` | WebSocket /task-runner namespace |
| `app/src/features/cluster/cluster.service.ts` | K8s API client -- pods, services, metrics, logs |
| `app/src/features/cluster/cluster.controller.ts` | REST: /cluster/* endpoints |
| `app/src/mcp-server.ts` | Workspace MCP server (git + sandbox + PR tools) |
| `app/src/github-issues-mcp.ts` | GitHub Issues MCP server (Designer) |
| `app/src/playwright-cdp-launcher.ts` | Playwright MCP via CDP to headless Chrome |

## Deployment

Deployed to the `the-dev-team` K8s namespace. The backend pod mounts a PVC at `/workspace` containing a clone of the repo. A headless Chrome sidecar (`headless-chrome`) runs alongside for the Designer's Playwright MCP.

## Commands

```bash
task devteam-backend:local:start       # NestJS dev server
task devteam-backend:local:build       # Compile TypeScript
task devteam-backend:local:test        # Unit tests
task devteam-backend:local:lint        # ESLint
```

## Related reading

- [Frontend](frontend.md)
- [Sandbox Environments](../../the-dev-team/sandbox-environments.md)
- [Kubernetes](../../infrastructure/kubernetes.md)
