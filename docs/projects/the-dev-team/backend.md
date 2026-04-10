# THE Dev Team -- Backend

The agent backend lives at `projects/the-dev-team/backend/`. It manages chat sessions, streams messages over WebSocket, integrates with the Claude Code SDK, and provides cluster introspection endpoints.

## Stack

- **NestJS 11** -- API framework
- **Claude Code SDK** (`@anthropic-ai/claude-agent-sdk`) -- AI provider
- **MCP Server** (`@modelcontextprotocol/sdk`) -- Structured tool access for git and workspace operations
- **Kubernetes client** (`@kubernetes/client-node`) -- Cluster introspection

## How it works

1. The frontend opens a WebSocket connection to the backend gateway
2. User messages arrive at `AgentGateway`, which forwards them to `AgentService`
3. `AgentService` manages sessions (create, resume, cancel) and builds a system prompt describing available tools
4. The `ClaudeCodeProvider` calls the Claude Code SDK `query()` function with:
    - The system prompt
    - An `allowedTools` whitelist (file ops + MCP tools only, no Bash)
    - An MCP server configuration pointing to the compiled `mcp-server.js`
5. Claude Code spawns the MCP server as a subprocess over stdio
6. The MCP server exposes 18 structured tools (git operations + sandbox deployment)
7. Response messages stream back through the gateway to the frontend

### MCP tool server

The MCP server (`app/src/mcp-server.ts`) provides all git and workspace tools. It runs commands via `execFile` (not a shell) against the repo at `/workspace`. Tools are grouped into:

**Git tools** (10): `git_status`, `git_diff`, `git_log`, `git_checkout`, `git_add`, `git_commit`, `git_push`, `git_pull`, `git_stash`, `git_branch`

**Workspace tools** (7): `create_worktree`, `deploy_sandbox`, `destroy_sandbox`, `list_sandboxes`, `sandbox_status`, `sandbox_logs`, `push_and_pr`

Sandbox tools delegate to `task env:*` commands from the Taskfile. Git tools call `git` directly.

### Cluster introspection

The `ClusterService` connects to the K8s API and exposes REST endpoints for:

- Pod listing with status, ports, CPU/memory usage
- Service listing per namespace
- Pod log streaming
- Prometheus metrics proxy (CPU, memory, network, request rates)
- Loki log search proxy

These power the frontend's DevOps dashboard.

### GitHub App authentication

`GithubTokenService` generates installation tokens from a GitHub App private key. Tokens are cached and auto-refreshed before expiry. Used for `git push` and `gh pr create` operations.

## Key source files

| File | Purpose |
|------|---------|
| `app/src/main.ts` | Entry point -- loads .env, bootstraps NestJS |
| `app/src/app.module.ts` | Root module: Health, CORS, Agent, Cluster |
| `app/src/features/agent/agent.service.ts` | Session management, system prompt, provider dispatch |
| `app/src/features/agent/agent.gateway.ts` | WebSocket gateway -- normalizes Claude SDK messages for frontend |
| `app/src/features/agent/agent.controller.ts` | REST: create/list/delete sessions, cancel |
| `app/src/features/agent/github-token.service.ts` | GitHub App JWT to installation token (auto-refresh) |
| `app/src/features/agent/providers/claude-code.provider.ts` | Claude Code SDK integration, MCP config, allowedTools whitelist |
| `app/src/features/agent/providers/provider.interface.ts` | AgentProvider, AgentMessage, AgentQueryOptions interfaces |
| `app/src/features/cluster/cluster.service.ts` | K8s API client -- pods, services, metrics, logs |
| `app/src/features/cluster/cluster.controller.ts` | REST: /cluster/pods, /cluster/services, /cluster/metrics, /cluster/logs |
| `app/src/mcp-server.ts` | MCP tool server -- git + workspace tools exposed to Claude Code |

## Deployment

Deployed to the `the-dev-team` K8s namespace. The pod mounts a PVC at `/workspace` containing a clone of the repo.

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
