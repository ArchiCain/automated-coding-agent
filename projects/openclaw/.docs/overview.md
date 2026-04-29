# OpenClaw — Overview

## What This Is

OpenClaw is the active agent runtime for this repo — a four-agent orchestration stack (orchestrator, devops, worker, tester) built on the `ghcr.io/openclaw/openclaw` gateway. Each agent is an OpenClaw persona with its own workspace, memory, and skill allowlist. A single human user drives documentation-driven development of `projects/application/` through conversation with the orchestrator, who delegates to specialists.

**Scope.** OpenClaw edits `projects/application/` (the benchmark backend + frontend + keycloak realm). OpenClaw itself is edited by Claude Code in the user's CLI — this separation is intentional (see `CLAUDE.md` → Division of labor). The prior orchestrator `projects/the-dev-team/` is frozen reference material; no comparison runs are active.

## Deployment topology

OpenClaw runs as a two-service docker-compose project under `infrastructure/compose/openclaw/`:

- **gateway** — the OpenClaw daemon (chat UI, agent orchestration, plugin host). Runs with `network_mode: host` so it can resolve `graphics-machine` over the tailnet; listens directly on host `:3001` (per `gateway.port` in `openclaw.json`).
- **git-sync** — a sidecar built from `dockerfiles/git-sync.Dockerfile` (alpine/git + curl + openssl, running as uid 1000). Mints GitHub App installation tokens every ~50 minutes and keeps `/workspace/repo` synced with `origin/dev`.
- **honcho-{db,redis,migrate,api,deriver}** — the self-hosted Honcho memory substack. `honcho-api` is published on `127.0.0.1:8000` so the host-networked gateway can reach it via `http://localhost:8000`. The other four services stay on the project's bridge network.

The gateway and git-sync share a named volume `workspace` mounted at `/workspace`; git-sync's clone is what the gateway reads for its `openclaw.json`, skills, and QMD index. Honcho's pgvector data lives in a separate named volume `honcho-db-data`.

The gateway container also bind-mounts the host's Docker socket (`/var/run/docker.sock`). That lets the `devops` agent run `docker compose` and `task env:*` directly against the host daemon — the sandbox provisioning path.

### Ports

| Service | Host | Container | Notes |
|---------|------|-----------|-------|
| gateway | 3001 | (host net) | Listens directly on the host via `network_mode: host` |
| git-sync | (none) | (sidecar only) | |
| honcho-api | 127.0.0.1:8000 | 8000 | Loopback only — only the gateway needs it |

### Running

- `task openclaw:up` — brings up both services.
- `task openclaw:down` — stops them, preserves the `workspace` volume.
- `task openclaw:down:clean` — wipes the volume, forces a fresh clone on next up.
- `task openclaw:logs` — tail both services.
- `task openclaw:pair` — approves a pending Web-UI device after the browser connects.
- `task openclaw:shell` — bash shell inside the gateway container.

See `projects/openclaw/Taskfile.yml` for the full list.

### Tailnet host deploy

Same compose project, deployed to `host-machine` (always-on Ubuntu on the tailnet) by `.github/workflows/deploy-dev.yml` on every push to `dev`. The gateway is reachable at `http://host-machine:3001` from any tailnet member, or via the MagicDNS HTTPS URL once Tailscale Funnel/Serve is configured.

## Agents

All four agents reason via the same self-hosted Ollama on `graphics-machine` (model `qwen-coder-next-256k`, 256K ctx — see `infrastructure/.docs/hosts.md`). Memory search embeddings come from `bge-m3-8k` running on `host-machine`. Provider registration lives in `app/openclaw.json` under `models.providers.ollama`; the only env-based credential is `OLLAMA_API_KEY`, a non-empty placeholder that activates OpenClaw's bundled Ollama plugin.

Each agent is a fully scoped OpenClaw persona — its own workspace, persona files (`SOUL.md`, `AGENTS.md`, `IDENTITY.md`), state directory, and session store. They are not the same agent wearing different role-prompt hats. The user picks which agent to talk to via the WebUI's agent selector.

| Agent | Emoji | Role | Writes | Does not write |
|-------|-------|------|--------|----------------|
| `orchestrator` (default) | 🎯 | Daily chat with user, spec authoring, doc curation, delegation, doc review | All of `.docs/` | Source code, tests |
| `devops` | 🛠 | Sandbox lifecycle, worktrees, branches, deploys, logs, PR/issue creation | (read-only everywhere) | — |
| `worker` | ⚙️ | Implementation per spec; coordinates with tester; opens PRs | Source code, `.docs/features/{X}/{contracts,flows,decisions}.md` | `spec.md`, `test-plan.md`, any test file, docs outside active feature |
| `tester` | 🧪 | Owns tests and test-plan.md; runs Playwright + API tests; reports findings | Test files, `.docs/features/{X}/test-plan.md` | Source code, other docs |

The test-writing separation is intentional — the worker cannot modify tests, so it cannot weaken them to make failures go away. If a test is genuinely wrong, the worker writes its argument in `decisions.md` and orchestrator routes the change to tester.

## Delegation

Agents delegate to each other via OpenClaw's sub-agent spawn (`sessions_spawn` with explicit `agentId`). The cross-agent allowlist is set under `agents.defaults.subagents.allowAgents`, covering all four agents. Sub-agent runs announce their results back to the requester when complete.

**Sub-agent context constraint:** OpenClaw injects `AGENTS.md` + `TOOLS.md` into spawned sub-agents — but **not** `SOUL.md`, `IDENTITY.md`, or `USER.md`. Anything load-bearing about how an agent should *behave* (not just sound) belongs in `AGENTS.md`. SOUL.md is voice-only and won't fire in delegation scenarios.

Phase B (Honcho) will add parent-observer relationships so orchestrator automatically sees what spawned children are doing, without polling `sessions_history`.

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

| Layer | Role | Config |
|-------|------|--------|
| Builtin (fallback) | Per-agent SQLite (FTS5 + vector), chunked memory files | Always on as QMD's fallback |
| **QMD** | Local search backend. Indexes `.docs/`, feature directories, and session transcripts. BM25 + vector + reranking. | `memory.backend: "qmd"` + `memory.qmd.paths: [...]` |
| **Active memory** | Proactive memory search before each reply (`recent` scope, `balanced` prompting) | `plugins["active-memory"]` |
| **Dreaming** | Nightly promotion of daily-notes → `MEMORY.md` per agent | `plugins["memory-core"].dreaming.enabled: true` + `cron.enabled: true` |
| **Honcho** | Cross-session memory + user/agent modeling + multi-agent observers (parent sees children) | `plugins["openclaw-honcho"]` pointed at `http://localhost:8000` (gateway is on host net; honcho-api published on loopback) |
| Compaction | Context (not memory) compaction on approaching model limits. Uses the same brain LLM as agents (`ollama/qwen-coder-next-256k`). | `agents.defaults.compaction.model` |

**Docs as memory.** QMD indexes `/workspace/repo/.docs/` recursively, plus each project's `src/features/**` directories. When an agent asks "what does feature X do," it's searching the literal specification. When an agent writes a doc, it's writing durable memory. The dreaming pipeline (daily notes → `MEMORY.md`) captures cross-session learnings on top of the doc-grounded base.

**Honcho as cross-agent memory.** Honcho persists every conversation turn to its own Postgres + pgvector store. It maintains a profile per user across sessions and channels, and registers parents as observers in spawned sub-agent sessions. Agents get tools like `honcho_context`, `honcho_search_messages`, `honcho_search_conclusions`, and `honcho_ask` for cross-session recall. The Honcho stack is **required** — `plugins.slots.memory` is bound to `openclaw-honcho`, so the gateway waits for `honcho-api` healthcheck before starting. If Honcho is unreachable at gateway start, the openclaw-honcho plugin caches the rejected promise and every `honcho_*` call returns the cached failure until the gateway restarts.

**Honcho deployment.** Five sibling compose services in `infrastructure/compose/openclaw/compose.yml`: `honcho-db` (pgvector pinned to v3.0.6 image), `honcho-redis` (queue), `honcho-migrate` (one-shot Alembic), `honcho-api` (FastAPI), `honcho-deriver` (background worker). Postgres data lives in the named volume `honcho-db-data`. Only `honcho-api` is exposed off the bridge — published on `127.0.0.1:8000` for the host-networked gateway.

**Honcho LLM routing.** Honcho's own LLM calls (deriver, summary, dialectic, dream) all route through the `custom` provider, which Honcho's `clients.py` instantiates as `AsyncOpenAI(base_url=..., api_key=...)`. `OPENAI_COMPATIBLE_BASE_URL` is set on each Honcho service to `http://host.docker.internal:11434/v1` (host-machine's Ollama via the bridge's host-gateway). Models target `qwen-coder-32k`. Embeddings use the `openrouter` provider (same env vars; Honcho hardcodes the embedding model name to `openai/text-embedding-3-small`, which we've aliased on host-machine to `bge-m3-8k` via `ollama cp`). Vector dimensions are 1024 (not the OpenAI-default 1536) because bge-m3 is 1024-dim. Full TOML in `infrastructure/compose/openclaw/honcho-config.toml`.

## Auth Model

| Credential | Purpose | Required |
|------------|---------|----------|
| `OLLAMA_API_KEY` | Activates OpenClaw's bundled Ollama provider plugin (any non-empty placeholder works for self-hosted Ollama) | Yes |
| `OPENCLAW_AUTH_TOKEN` | Browser → gateway auth (pairing) | Yes |
| `HONCHO_DB_PASSWORD` | Postgres password for the honcho-db service | Optional (defaults to `honcho`; the DB is internal to the compose project, not exposed off-host) |
| GitHub App (`GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, `github-app-key` file) | Git-sync sidecar auth — mints installation tokens for repo pulls | Yes |

No cloud LLM API keys. Honcho's LLM env vars (`LLM_OPENAI_COMPATIBLE_API_KEY`, `LLM_OPENAI_COMPATIBLE_BASE_URL`) are wired in `compose.yml` from `OLLAMA_API_KEY` + a literal endpoint string — they don't need separate top-level secrets.

## Pairing Flow

The Web UI requires a browser secure context (HTTPS or `localhost`) for device crypto. Locally the gateway is reachable at `http://localhost:3001` (localhost qualifies as secure). On the deployed tailnet host, browser access is via `http://host-machine:3001` from any tailnet member (Tailscale itself supplies the secure transport).

1. Browser: open the gateway URL
2. Enter `OPENCLAW_AUTH_TOKEN` as the Gateway Token → "pairing required"
3. Terminal: `task openclaw:pair` — approves the pending device via `openclaw devices approve <id>` inside the container
4. Browser re-clicks Connect → authenticated session

## Per-agent workspaces

Each agent has its own workspace at `/workspace/.openclaw/workspaces/<agent>/` (inside the gateway container, on the `workspace` named volume). The workspace mixes two file types with very different lifecycles:

| Type | Files | Origin | Persistence |
|------|-------|--------|-------------|
| **Persona** | `SOUL.md`, `AGENTS.md`, `IDENTITY.md` | Versioned in git at `projects/openclaw/app/workspaces/<agent>/` | Re-seeded from git on every gateway boot |
| **Memory** | `memory/YYYY-MM-DD.md`, `MEMORY.md`, `DREAMS.md` | Written by the agent at runtime | Survives container restarts in the Docker volume; not in git |

The entrypoint copies persona files from the synced repo into the runtime workspace on boot but **never touches** memory files — agent state survives restarts. Backup of memory files is addressed by Phase B (Honcho persists conversations to Postgres).

Per-agent skill allowlists are configured via `agents.list[].skills`. Today every agent gets only the `repo-tasks` shared skill; per-agent capability skills can be added later as needed.

## Skills

- Skill folders live under `projects/openclaw/app/skills/` and follow the AgentSkills convention — each skill is a directory containing `SKILL.md`.
- Currently shipped: `repo-tasks/` (task-over-raw-command rule, available to all four agents).
- Skills are synced into the gateway via the git-sync sidecar and exposed through `skills.load.extraDirs: ["./skills"]`.

## MCP servers

None currently configured. OpenClaw mounts external tool servers via `mcp.servers` in `openclaw.json` when needed.

## Directory Layout

```
projects/openclaw/
├── .docs/overview.md              ← this file
├── README.md                      ← human quickstart
├── Taskfile.yml                   ← up/down/logs/pair/shell tasks
├── app/
│   ├── openclaw.json              ← gateway config (4 agents, per-agent workspaces, QMD, Honcho plugin)
│   ├── workspaces/                ← persona files (SOUL/AGENTS/IDENTITY), seeded into runtime on boot
│   │   ├── orchestrator/{SOUL,AGENTS,IDENTITY}.md
│   │   ├── devops/{SOUL,AGENTS,IDENTITY}.md
│   │   ├── worker/{SOUL,AGENTS,IDENTITY}.md
│   │   └── tester/{SOUL,AGENTS,IDENTITY}.md
│   └── skills/                    ← AgentSkills directories (one per skill)
│       └── repo-tasks/SKILL.md    ← task-over-raw-command rule (shared)
└── dockerfiles/
    ├── prod.Dockerfile            ← gateway image (base + QMD + Honcho plugin)
    ├── git-sync.Dockerfile        ← alpine/git + curl + openssl sidecar
    ├── entrypoint.sh              ← seeds personas, installs Honcho plugin
    ├── git-credential-helper.sh   ← reads installation token written by git-sync sidecar
    └── gh-wrapper.sh              ← shadows /usr/bin/gh; reads same installation token for `gh` calls
```

## Relationship to Other Projects

| Project | Role |
|---------|------|
| `projects/application/` | The benchmark app. OpenClaw's workers build and test features here. |
| `projects/the-dev-team/` | Frozen reference. Prior orchestrator; not runnable. Don't edit. |
| `projects/openclaw/` | This runtime. Edited by Claude Code, not by OpenClaw itself. |

## Known Uncertainties

- **WebUI agent selector.** The WebUI exposes per-agent chat surfaces — the user picks who to talk to before sending. To be smoke-tested as part of Phase 1 verification.

## What's Next

- Verify Honcho observer relationships end-to-end (orchestrator sees worker's tool use)
- Per-agent MCP server gating once OpenClaw exposes that as first-class config
- Channel integrations: Slack/Telegram bots per agent for the "real teammate" UX
- Pre-warm `qwen-coder-32k` on host-machine at boot so Honcho's first deriver call doesn't time out on cold-load (~12 s for the 26 GB model)
