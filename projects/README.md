# Projects

Three project groups. Two are active; one is frozen reference.

## Benchmark application (`projects/application/`) — **edited by OpenClaw**

The application OpenClaw's agents build and iterate on. Lives at `http://localhost:3000` after `task up`.

| Project | Path | Stack | Description |
|---------|------|-------|-------------|
| **backend** | `projects/application/backend` | NestJS | API server + WebSocket for agent chat |
| **frontend** | `projects/application/frontend` | Angular | Angular SPA |
| **database** | `projects/application/database` | PostgreSQL (pgvector/pgvector:pg16) | Not a deployable — just the Dockerfile legacy; compose uses the image directly |
| **keycloak** | `projects/application/keycloak` | Keycloak 23 + realm export | Auth provider |

Humans should not edit this tree directly. File an issue, or talk to the OpenClaw orchestrator at `http://localhost:3001` and delegate.

## OpenClaw (`projects/openclaw/`) — **edited by Claude Code**

The agent runtime. One Dockerfile, one git-sync sidecar Dockerfile, an `openclaw.json` config, five agent skill files, and a Taskfile.

| Path | Purpose |
|------|---------|
| `projects/openclaw/dockerfiles/prod.Dockerfile` | Gateway image (chromium + QMD + docker CLI + task) |
| `projects/openclaw/dockerfiles/git-sync.Dockerfile` | Sidecar image (alpine/git + curl + openssl) |
| `projects/openclaw/dockerfiles/entrypoint.sh` | Gateway boot sequence: git fetch, seed config, start OpenClaw |
| `projects/openclaw/app/openclaw.json` | Gateway + browser + agents config |
| `projects/openclaw/app/skills/` | Per-agent prompt + tool-scope files (orchestrator, devops, worker, tester, repo-tasks) |
| `projects/openclaw/Taskfile.yml` | `task openclaw:*` — compose lifecycle wrappers |

Edit in this Claude Code session. After changes, rebuild + recreate the gateway container:
```
task openclaw:build && task openclaw:restart
```

## THE Dev Team (`projects/the-dev-team/`) — **frozen reference**

The prior orchestrator (NestJS + Mastra + Claude Agent SDK). Kept for reference while OpenClaw matures. **Not runnable post-migration.** Its Helm chart was deleted in the k8s→compose migration; it has no compose-project equivalent.

Do not edit. If you find yourself about to, stop — the change probably belongs under `projects/openclaw/` or `projects/application/` instead.

| Path | Status |
|------|--------|
| `projects/the-dev-team/backend` | Frozen |
| `projects/the-dev-team/frontend` | Frozen |

Runtime data from earlier the-dev-team runs might still live under `.the-dev-team/` at the repo root — safe to delete.
