# THE Dev Team — Backend

The backend is the orchestrator for THE Dev Team. It lives at `projects/the-dev-team/backend/`.

## Stack

- **NestJS 11** — API framework
- **Claude Code SDK** — AI provider integration
- **MCP Server** — Structured tool access (git, workspace, sandbox lifecycle)

## Responsibilities

- Session management (create, list, delete, resume)
- WebSocket gateway for real-time streaming to the frontend
- GitHub App authentication (JWT to installation token, auto-refresh)
- MCP tool server exposing git and workspace tools to Claude Code
- Cluster introspection (pods, services, metrics, logs via K8s API)

## Key source files

| File | Purpose |
|------|---------|
| `app/src/main.ts` | Entry point — loads .env, bootstraps NestJS |
| `app/src/app.module.ts` | Root module: Health, CORS, Agent, Cluster |
| `app/src/features/agent/agent.service.ts` | Session management, system prompt, provider dispatch |
| `app/src/features/agent/agent.gateway.ts` | WebSocket gateway |
| `app/src/features/agent/providers/claude-code.provider.ts` | Claude Code SDK integration |
| `app/src/features/cluster/cluster.service.ts` | K8s API client |
| `app/src/mcp-server.ts` | MCP tool server (git + workspace tools) |

## Deployment

Deployed to the `the-dev-team` K8s namespace as the `the-dev-team-backend` release. See [Kubernetes](../../infrastructure/kubernetes.md) for the Helmfile configuration.

## Commands

```bash
task devteam-backend:local:start       # NestJS dev server
task devteam-backend:local:build       # Compile TypeScript
task devteam-backend:local:test        # Unit tests
task devteam-backend:local:lint        # ESLint
```

## Related reading

- [THE Dev Team Overview](../../the-dev-team/overview.md)
- [Execution Loop](../../the-dev-team/execution-loop.md)
- [Configuration](../../the-dev-team/configuration.md)
