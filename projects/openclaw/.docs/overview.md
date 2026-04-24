# OpenClaw — Overview

## What This Is

OpenClaw is the active agent runtime for this repo — a four-agent orchestration stack (orchestrator, devops, worker, tester) built on the `ghcr.io/openclaw/openclaw` gateway. Each agent is an OpenClaw persona with its own workspace, memory, and skill allowlist. A single human user drives documentation-driven development of `projects/application/` through conversation with the orchestrator, who delegates to specialists.

**Scope.** OpenClaw edits `projects/application/` (the benchmark backend + frontend + keycloak realm). OpenClaw itself is edited by Claude Code in the user's CLI — this separation is intentional (see `CLAUDE.md` → Division of labor). The prior orchestrator `projects/the-dev-team/` is frozen reference material; no comparison runs are active.

## Deployment topology

OpenClaw runs as a two-service docker-compose project under `infrastructure/compose/openclaw/`:

- **gateway** — the OpenClaw daemon (chat UI, agent orchestration, plugin host). Listens on container `:18789`, published on host `:3001`.
- **git-sync** — a sidecar built from `dockerfiles/git-sync.Dockerfile` (alpine/git + curl + openssl, running as uid 1000). Mints GitHub App installation tokens every ~50 minutes and keeps `/workspace/repo` synced with `origin/dev`.

Both services share a named volume `workspace` mounted at `/workspace`; git-sync's clone is what the gateway reads for its `openclaw.json`, skills, and QMD index.

The gateway container also bind-mounts the host's Docker socket (`/var/run/docker.sock`). That lets the `devops` agent run `docker compose` and `task env:*` directly against the host daemon — the sandbox provisioning path.

### Ports

| Service | Host | Container |
|---------|------|-----------|
| gateway | 3001 | 18789 |
| git-sync | (none) | (sidecar only) |

### Running

- `task openclaw:up` — brings up both services.
- `task openclaw:down` — stops them, preserves the `workspace` volume.
- `task openclaw:down:clean` — wipes the volume, forces a fresh clone on next up.
- `task openclaw:logs` — tail both services.
- `task openclaw:pair` — approves a pending Web-UI device after the browser connects.
- `task openclaw:shell` — bash shell inside the gateway container.

See `projects/openclaw/Taskfile.yml` for the full list.

### Deploy to host-machine

Same compose project; `compose.prod.yml` swaps the `build:` blocks for `ghcr.io/archicain/automated-coding-agent-openclaw-*` image references. CI runs `scripts/deploy.sh` to rsync compose files onto host-machine and `docker compose pull && up -d`. Reached over the tailnet at `http://<host-machine>:3001`.

## Agents

All four agents reason via the Anthropic API using `ANTHROPIC_API_KEY`. Memory search uses OpenAI embeddings via `OPENAI_API_KEY`. The `claude-opus-4-6` model with 1M-token context is configured as the default for all agents.

| Agent | Role | Writes | Does not write |
|-------|------|--------|----------------|
| `orchestrator` (default) | Daily chat with user, spec authoring, doc curation, delegation, doc review | All of `.docs/` | Source code, tests |
| `devops` | Sandbox lifecycle, worktrees, branches, deploys, logs, PR/issue creation | (read-only everywhere) | — |
| `worker` | Implementation per spec; coordinates with tester; opens PRs | Source code, `.docs/features/{X}/{contracts,flows,decisions}.md` | `spec.md`, `test-plan.md`, any test file, docs outside active feature |
| `tester` | Owns tests and test-plan.md; runs Playwright + API tests; reports findings | Test files, `.docs/features/{X}/test-plan.md` | Source code, other docs |

The test-writing separation is intentional — the worker cannot modify tests, so it cannot weaken them to make failures go away. If a test is genuinely wrong, the worker writes its argument in `decisions.md` and orchestrator routes the change to tester.

## Delegation

Agent-to-agent calls are enabled (`tools.agentToAgent.enabled: true`) with an allowlist covering all four agents. Orchestrator is the user-facing surface; the other three are invoked by orchestrator. Users don't address workers, devops, or tester directly.

Delegation prefers sub-agent spawn (for Honcho-style parent-observer relationships, once Honcho is added in Phase B). It falls back to the A2A tool if sub-agent spawn isn't available for named agents.

## Branching Model

**Single `dev` branch** as OpenClaw's daily driver.

```
main                          ← production. Human-only promotion from dev.
 │
 └── dev                      ← OpenClaw's daily-driver base branch.
      │                         · orchestrator commits docs, skills, openclaw.json directly
      │                         · feature work branches off here
      │
      ├── feat/X              ← sandbox branch for feature X (git worktree)
      │    · worker commits code, tester commits tests
      │    · PR'd into `dev` when green
      │
      └── feat/Y              ← parallel feature, independent
```

- **Stream A** (orchestrator doc/config edits): direct commits to `dev`, real-time review in chat. No PR.
- **Stream B** (feature work): `feat/X` branch in a git worktree at `/workspace/worktrees/feat-X/` paired with a sandbox compose project. PR → `dev` when tests pass.
- **Promotion to `main`**: human opens a PR from `dev` → `main` on demand. OpenClaw never touches `main` autonomously.

## Workspace & Git Sync

The `workspace` named volume is mounted at `/workspace` inside both services. Inside:

- `/workspace/repo/` — the primary worktree on `dev`, managed by the git-sync sidecar
- `/workspace/worktrees/feat-X/` — feature worktrees created by `devops` (one per active sandbox)
- `/workspace/.openclaw/` — agent state (session stores, per-agent memory, skills symlink)

The **git-sync sidecar** is a small alpine/git container that:

1. On first start, clones `$OPENCLAW_GIT_REPO_URL` at branch `$OPENCLAW_GIT_BRANCH` (default `dev`) into `/workspace/repo`.
2. Every `$OPENCLAW_GIT_INTERVAL` seconds (default 60), fetches origin and fast-forward-merges.
3. **Authenticates via a GitHub App** that has installation access on this repo. On startup and every 50 minutes thereafter, it generates a JWT from the mounted PEM, exchanges it for a short-lived installation access token, and injects that token into the HTTPS git URL. No PAT needed.

The sidecar only pulls. Orchestrator (and workers in their own feature worktrees) are responsible for pushing their commits promptly — if local `dev` diverges from origin/dev, the ff-only merge will refuse and log a conflict. Manual reconciliation is required in that case (rare).

Soft changes — skills, `openclaw.json`, `.docs/` — are picked up by the gateway when it reloads config. Hard changes — Dockerfile, entrypoint, compose layout — require a rebuild and bounce of the compose project.

## Memory Stack

Phase A is a stripped-down memory system; Honcho is deferred to Phase B.

| Layer | Role | Config |
|-------|------|--------|
| Builtin | Per-agent SQLite (FTS5 + vector), chunked memory files | On by default |
| **QMD** | Search backend replacing builtin. Indexes docs + feature directories + session transcripts. | `memory.backend: "qmd"` + `memory.qmd.paths: [".docs/", ...]` |
| **Active memory** | Proactive memory search before each reply (`recent` scope, `balanced` prompting) | `activeMemory.{queryMode,promptStyle}` |
| **Dreaming** | Nightly cron (03:00 UTC) promotes daily-notes → `MEMORY.md` | `plugins["memory-core"].dreaming.enabled: true` + cron enabled |
| Compaction | Context (not memory) compaction on approaching model limits. Uses Sonnet as the summarization model. | `agents.defaults.compaction.model` |
| Honcho (Phase B) | Cross-agent session sharing, parent-observer relationships | Not yet |

**Docs as memory.** QMD indexes `/workspace/repo/.docs/` recursively, plus each project's `src/features/**` directories. When an agent asks "what does feature X do," it's searching the literal specification. When an agent writes a doc, it's writing durable memory. The promotion pipeline from daily notes → `MEMORY.md` captures cross-session learnings (user preferences, recurring patterns, gotchas) on top of the doc-grounded base.

## Auth Model

| Credential | Purpose | Required |
|------------|---------|----------|
| `ANTHROPIC_API_KEY` | Agent reasoning — all four agents | Yes |
| `OPENAI_API_KEY` | Memory search embeddings | Yes |
| `OPENCLAW_AUTH_TOKEN` | Browser → gateway auth (pairing) | Yes |
| GitHub App (`GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, `github-app-key` file) | Git-sync sidecar auth — mints installation tokens | Yes |

No OAuth token, no Claude Code CLI. The API key is the primary reasoning credential.

## Pairing Flow

The Web UI requires a browser secure context (HTTPS or `localhost`) for device crypto. On the tailnet, Tailscale serves HTTPS for the gateway hostname (`tailscale serve`), which qualifies as a secure context. When connecting from host-machine itself, `http://localhost:3001` also works.

1. Browser: open the gateway URL
2. Enter `OPENCLAW_AUTH_TOKEN` as the Gateway Token → "pairing required"
3. Terminal: `task openclaw:pair` — approves the pending device via `openclaw devices approve <id>` inside the container
4. Browser re-clicks Connect → authenticated session

## Skills + agents

- Agents: `orchestrator`, `devops`, `worker`, `tester`.
- Skills live under `projects/openclaw/app/skills/` (synced into the gateway via the git-sync sidecar).
- The devops skill (`devops.md`) drives sandbox lifecycle via `task env:*`.

## Directory Layout

```
projects/openclaw/
├── .docs/overview.md              ← this file
├── README.md                      ← human quickstart
├── Taskfile.yml                   ← up/down/logs/pair/shell tasks
├── app/
│   ├── openclaw.json              ← gateway config (4 agents, QMD, active memory, dreaming)
│   ├── SOUL.md                    ← agent identity (evolves over time)
│   ├── HEARTBEAT.md               ← safety-net monitor (evolves)
│   └── skills/                    ← role prompts and shared rules
│       ├── repo-tasks.md          ← task-over-raw-command rule (shared)
│       ├── orchestrator.md
│       ├── devops.md
│       ├── worker.md
│       └── tester.md
└── dockerfiles/
    ├── prod.Dockerfile            ← gateway image (base + QMD)
    ├── git-sync.Dockerfile        ← alpine/git + curl + openssl sidecar
    └── entrypoint.sh              ← requires ANTHROPIC_API_KEY + OPENAI_API_KEY
```

## Relationship to Other Projects

| Project | Role |
|---------|------|
| `projects/application/` | The benchmark app. OpenClaw's workers build and test features here. |
| `projects/the-dev-team/` | Frozen reference. Prior orchestrator; not runnable. Don't edit. |
| `projects/openclaw/` | This runtime. Edited by Claude Code, not by OpenClaw itself. |

## Known Uncertainties

- **Sub-agent spawn to named agent.** Whether OpenClaw's sub-agent spawn primitive can target a specific agent from `agents.list` (the `dev` persona, for example) is unverified. If it can, orchestrator spawns dev as a child session and gets Honcho's free observer relationships (Phase B). If it can't, delegation uses the A2A tool instead — architecture is unchanged, just the invocation shape.
- **Skill file format.** The skill frontmatter format is based on Claude Code conventions. OpenClaw may have a slightly different shape; we'll correct if load errors surface.
- **Per-agent skill allowlists.** Currently every agent sees every skill. Per-agent filtering (`agents.list[].skills`) is a future refinement.

## What's Next (Phase B)

- Self-hosted Honcho release (new compose service, Postgres-backed)
- `plugins.entries["openclaw-honcho"]` wired to the self-hosted URL
- Observer relationships verified end-to-end (orchestrator sees dev's tool use)
- Embedding provider swap to local Ollama (once DGX Spark is online)
- Model provider swap to local vLLM (Phase C)
