# OpenClaw — Overview

## What This Is

OpenClaw is the active agent runtime for this repo — a multi-agent orchestration stack built on the `ghcr.io/openclaw/openclaw` gateway, running in **multi-orchestrator mode**: each domain has one user-facing lead, with private specialists below it where the work warrants splitting.

- **Software development vertical** — `orchestrator` (lead) + `devops` + `worker` + `tester`. Drives documentation-driven development of `projects/application/`.
- **Personal-life single-agent verticals** — `email` (inbox triage) and `backpacking` (trip prep). Skeleton today; gain capability when their upstream integrations land (IMAP/Gmail MCP for email; maps MCP + gear inventory for backpacking).
- **D&D vertical** — `dnd` (player-side lead) + `dnd-dm` (co-DM specialist) + `dnd-chargen` (character creation specialist). Skeleton today; gains capability when the SRD vector index, dice/character tooling, and (eventually) the voice/at-the-table prototype land. See `ideas/dnd-5e-agents.md` for the phased plan.

Each agent is an OpenClaw persona with its own workspace, memory, and skill allowlist. The user picks who to talk to via the WebUI's agent selector.

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

All six agents reason on **`openai-codex/gpt-5.5`** via OpenClaw's first-class `openai-codex` provider, authenticated through the user's ChatGPT Pro 5× subscription (OAuth). The self-hosted Qwen3-Coder-Next 80B-A3B on `graphics-machine` (`qwen-coder-next-256k`, 256K ctx — see `infrastructure/.docs/hosts.md`) is configured as the **single fallback** for resilience: if Codex is unreachable or auth fails, agents continue against the local brain. Both providers are registered in `app/openclaw.json` under `models.providers`; per-agent `model` blocks set `primary` to `openai-codex/gpt-5.5` and `fallbacks` to `["ollama/qwen-coder-next-256k"]`. Runtime context is capped at OpenClaw's default 272K (out of native 1M) for latency/quality.

**Three-tier model topology:**

| Tier | Endpoint | Model | Job |
|---|---|---|---|
| Brain (Tier-1) | OpenAI cloud (OAuth via ChatGPT Pro 5×) | `openai-codex/gpt-5.5` | All agents' reasoning |
| Brain fallback (Tier-1 local) | `ollama/` → `http://graphics-machine:11434` | `qwen-coder-next-256k` (Qwen3-Next 80B MoE / 3B active) | Resilience only |
| Tier-2 fast (planned) | `ollama-host/` → `http://host-machine:11434` | `gemma4-e4b-128k` (Gemma 4 E4B, 128K ctx, native JSON) | Honcho deriver + per-skill triage / classification / JSON extraction inside email and backpacking |
| Embeddings | OpenAI-compat shim → `http://host-machine:11434/v1` | `bge-m3-8k` (1024-dim) | QMD vector search + Honcho memory |

All nine agents inherit Tier-1 as their model default. Tier-2 is reached at the **skill** level via explicit `model:` overrides, not the agent default. Software agents (orchestrator, devops, worker, tester) rarely need Tier-2 in their hot path; the personal-life and D&D agents will pin classification, retrieval, and validation skills to Tier-2 explicitly when those skills are written. See `ideas/model-tiering-decision.md` for the full reasoning.

Auth state for the OpenAI Codex OAuth profile is managed by OpenClaw itself (not via env vars); the only env-based credential remaining is `OLLAMA_API_KEY`, a non-empty placeholder that activates OpenClaw's bundled Ollama plugin for the fallback and Tier-2 paths.

Each agent is a fully scoped OpenClaw persona — its own workspace, persona files (`SOUL.md`, `AGENTS.md`, `IDENTITY.md`), state directory, and session store. They are not the same agent wearing different role-prompt hats. The user picks which agent to talk to via the WebUI's agent selector.

**Core software agents** (drive `projects/application/`):

| Agent | Emoji | Role | Writes | Does not write |
|-------|-------|------|--------|----------------|
| `orchestrator` (default) | 🎯 | Daily chat with user, spec authoring, doc curation, delegation, doc review | All of `.docs/` | Source code, tests |
| `devops` | 🛠 | Sandbox lifecycle, worktrees, branches, deploys, logs, PR/issue creation | (read-only everywhere) | — |
| `worker` | ⚙️ | Implementation per spec; coordinates with tester; opens PRs | Source code, `.docs/features/{X}/{contracts,flows,decisions}.md` | `spec.md`, `test-plan.md`, any test file, docs outside active feature |
| `tester` | 🧪 | Owns tests and test-plan.md; runs Playwright + API tests; reports findings | Test files, `.docs/features/{X}/test-plan.md` | Source code, other docs |

**Personal-life agents** (single-agent verticals; skeletons until upstream integrations land):

| Agent | Emoji | Role | Skeleton state | Blocked on |
|-------|-------|------|----------------|------------|
| `email` | 📬 | Inbox triage, action-item extraction, reply drafts | Persona files + empty `skills/` placeholder | IMAP/Gmail MCP server |
| `backpacking` | 🎒 | Trip prep, gear inventory, route summaries | Persona files + empty `skills/` placeholder | Maps MCP server + gear inventory store |

**D&D vertical** (lead + specialists; skeletons until SRD index and tooling land):

| Agent | Emoji | Role | Skeleton state | Blocked on |
|-------|-------|------|----------------|------------|
| `dnd` | 🐉 | Player-side lead. Daily play support, rules lookups, decision recall, single-step sheet updates. | Persona files + empty `skills/` placeholder | 5e SRD vector index, dice roller, character sheet store |
| `dnd-dm` | 🎲 | Co-DM specialist. Encounter design, NPC generation, initiative tracking, session recaps. Spawned by `dnd`. | Persona files + empty `skills/` placeholder | Same as `dnd` + encounter math + initiative state store |
| `dnd-chargen` | 🧙 | Character creation specialist. Multi-step builds, retrains, level-up walkthroughs. Spawned by `dnd`. | Persona files + empty `skills/` placeholder | Same as `dnd` + character JSON schema |

The personal-life leads (`email`, `backpacking`) and the domain leads (`orchestrator`, `dnd`) are all **peer personas** the user talks to directly. Specialists (`devops`, `worker`, `tester`, `dnd-dm`, `dnd-chargen`) are spawned by their lead via `sessions_spawn`; per-agent subagent allowlists enforce the delegation graph (see § Delegation graph below). See `ideas/agent-hierarchy.md` for the rationale.

The test-writing separation is intentional — the worker cannot modify tests, so it cannot weaken them to make failures go away. If a test is genuinely wrong, the worker writes its argument in `decisions.md` and orchestrator routes the change to tester.

## Delegation graph

OpenClaw runs in **multi-orchestrator** mode — each domain has its own user-facing lead, with private specialists below it. Agents delegate via `sessions_spawn` with explicit `agentId`; sub-agent runs announce their results back to the requester when complete.

The delegation allowlist is **not global** — `agents.defaults.subagents.allowAgents` is `[]` (deny by default), and each agent's permitted spawn targets are set explicitly under `agents.list[].subagents.allowAgents`. `requireAgentId: true` forces every spawn call to name its target.

| Lead (user-facing) | Vertical | Can spawn |
|---|---|---|
| `orchestrator` 🎯 | Software development | `devops`, `worker`, `tester` |
| `email` 📬 | Inbox triage | (no specialists; single-agent + skills) |
| `backpacking` 🎒 | Trip prep | (no specialists; single-agent + skills) |
| `dnd` 🐉 | D&D 5e play | `dnd-dm`, `dnd-chargen` |

Specialists (`devops`, `worker`, `tester`, `dnd-dm`, `dnd-chargen`) appear in the WebUI selector today because OpenClaw doesn't yet expose a "subagent-only / hide from selector" flag — convention is *talk to the lead*, not directly to a specialist. The one peer-to-peer link is `worker → tester` (mandatory verification handoff per worker's AGENTS.md). Everything else is `lead → specialist` only. See `ideas/agent-hierarchy.md` for the rationale and the recipe for adding new verticals.

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
| Compaction | Context (not memory) compaction on approaching model limits. Pinned to local `ollama/qwen-coder-next-256k` on `graphics-machine` (async/background workload — kept on local even though the agent brain is now OpenAI Codex). | `agents.defaults.compaction.model` |

**Docs as memory.** QMD indexes `/workspace/repo/.docs/` recursively, plus each project's `src/features/**` directories. When an agent asks "what does feature X do," it's searching the literal specification. When an agent writes a doc, it's writing durable memory. The dreaming pipeline (daily notes → `MEMORY.md`) captures cross-session learnings on top of the doc-grounded base.

**Honcho as cross-agent memory.** Honcho persists every conversation turn to its own Postgres + pgvector store. It maintains a profile per user across sessions and channels, and registers parents as observers in spawned sub-agent sessions. Agents get tools like `honcho_context`, `honcho_search_messages`, `honcho_search_conclusions`, and `honcho_ask` for cross-session recall. The Honcho stack is **required** — `plugins.slots.memory` is bound to `openclaw-honcho`, so the gateway waits for `honcho-api` healthcheck before starting. If Honcho is unreachable at gateway start, the openclaw-honcho plugin caches the rejected promise and every `honcho_*` call returns the cached failure until the gateway restarts.

**Honcho deployment.** Five sibling compose services in `infrastructure/compose/openclaw/compose.yml`: `honcho-db` (pgvector pinned to v3.0.6 image), `honcho-redis` (queue), `honcho-migrate` (one-shot Alembic), `honcho-api` (FastAPI), `honcho-deriver` (background worker). Postgres data lives in the named volume `honcho-db-data`. Only `honcho-api` is exposed off the bridge — published on `127.0.0.1:8000` for the host-networked gateway.

**Honcho LLM routing.** Honcho's own LLM calls (deriver, summary, dialectic, dream) all route through the `custom` provider, which Honcho's `clients.py` instantiates as `AsyncOpenAI(base_url=..., api_key=...)`. `OPENAI_COMPATIBLE_BASE_URL` is set on each Honcho service to `http://host.docker.internal:11434/v1` (host-machine's Ollama via the bridge's host-gateway). Models target `gemma4-e4b-128k` (the Tier-2 model — right-sized for the deriver's short JSON-emitting summarization workload). The prior `qwen-coder-32k` stays installed on host-machine as a fallback but is not referenced in `honcho-config.toml`. Embeddings use the `openrouter` provider (same env vars; Honcho hardcodes the embedding model name to `openai/text-embedding-3-small`, which we've aliased on host-machine to `bge-m3-8k` via `ollama cp`). Vector dimensions are 1024 (not the OpenAI-default 1536) because bge-m3 is 1024-dim. Full TOML in `infrastructure/compose/openclaw/honcho-config.toml`.

## Auth Model

| Credential | Purpose | Required |
|------------|---------|----------|
| OpenAI Codex OAuth profile | ChatGPT Pro 5× subscription auth for the `openai-codex/gpt-5.5` brain. Established once via `openclaw onboard --auth-choice openai-codex --device-code` (or `openclaw models auth login --provider openai-codex --device-code` for headless). OpenClaw stores the resulting tokens in its own auth store — not env-based. | Yes |
| `OLLAMA_API_KEY` | Activates OpenClaw's bundled Ollama provider plugin (any non-empty placeholder works for self-hosted Ollama). Powers the fallback brain on `graphics-machine` and host-machine embeddings/Honcho. | Yes |
| `OPENCLAW_AUTH_TOKEN` | Browser → gateway auth (pairing) | Yes |
| `HONCHO_DB_PASSWORD` | Postgres password for the honcho-db service | Optional (defaults to `honcho`; the DB is internal to the compose project, not exposed off-host) |
| GitHub App (`GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, `github-app-key` file) | Git-sync sidecar auth — mints installation tokens for repo pulls | Yes |

No cloud LLM API keys — the OpenAI brain is reached through subscription OAuth, not a per-token API key. Honcho's LLM env vars (`LLM_OPENAI_COMPATIBLE_API_KEY`, `LLM_OPENAI_COMPATIBLE_BASE_URL`) are wired in `compose.yml` from `OLLAMA_API_KEY` + a literal endpoint string — they don't need separate top-level secrets.

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
│   │   ├── tester/{SOUL,AGENTS,IDENTITY}.md
│   │   ├── email/{SOUL,AGENTS,IDENTITY}.md + skills/README.md       ← skeleton; needs IMAP/Gmail MCP
│   │   ├── backpacking/{SOUL,AGENTS,IDENTITY}.md + skills/README.md ← skeleton; needs maps MCP + inventory store
│   │   ├── dnd/{SOUL,AGENTS,IDENTITY}.md + skills/README.md         ← skeleton; D&D player lead
│   │   ├── dnd-dm/{SOUL,AGENTS,IDENTITY}.md + skills/README.md      ← skeleton; co-DM specialist
│   │   └── dnd-chargen/{SOUL,AGENTS,IDENTITY}.md + skills/README.md ← skeleton; chargen specialist
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
