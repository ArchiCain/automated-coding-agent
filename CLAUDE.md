# CLAUDE.md

## Pick up here next session

**Local dev mode is operational end-to-end.** Nine agents across four verticals chat via `openai-codex/gpt-5.5` (Pro 5× OAuth). Four Telegram bots route to the four lead agents (`dev-main`, `dnd-main`, `email-main`, `backpacking-main`). Image and video generation are enabled via the same OAuth (`openai/gpt-image-2`, `openai/sora-2`). The path from fresh laptop to working agent is two task targets (`openclaw:up:local`, `openclaw:auth:codex:local`); host-machine bring-up uses the same targets without `:local`.

### Where to pick up

1. **Smoke test the agent hierarchy + channels.** Topology is proven for solo chat; multi-agent guarantees and per-channel routing aren't exercised end-to-end yet. Run the six-step sequence from `multi-agent-openclaw.md` plus the Telegram-routing check below:
   - presence (`dev-main` says hi as itself, `devops` as itself, etc.)
   - voice (each agent's SOUL.md actually shapes the response)
   - permitted delegation (`dev-main` → `worker` succeeds)
   - **forbidden delegation hard-fail** (`dev-main` → `dnd-dm` should be rejected by `subagents.allowAgents`, not silently succeed)
   - brain fallback (cut Codex auth or simulate failure → falls through to local Qwen — note the thinking-mode incompatibility under "Known issues")
   - memory (Honcho captures and retrieves a fact across sessions)
   - **Telegram routing**: DM each bot, confirm the correct lead agent answers. First message has 10-30s cold-start latency — that's expected, not a bug.
   - Steps 4, 5, and the Telegram check are the ones most often skipped. Don't skip them.

2. **Build out the per-vertical features the skeletons are blocked on.** The leads exist and respond, but the verticals aren't useful yet:
   - **Backpacking**: needs an inventory store (CSV in workspace works for MVP), a maps MCP, and a PDF skill (Chromium-headless wrapping markdown templates) for trip checklists.
   - **D&D**: needs SRD vector index, dice roller, character JSON store. Image gen for character portraits is now turn-key (`/tool image_generate model=openai/gpt-image-2 ...`); the dnd-main agent just needs persona instructions teaching it when to call.
   - **Email**: needs IMAP/Gmail MCP. Blocked until that's wired.
   - **Software development**: already active; the open question is whether to ramp up by giving worker/tester real PRs against `projects/application/`.

3. **Bring up `host-machine` (prod) when the household move settles.** The dev work front-loaded the gotchas; prod is the same path against the prod compose file:
   - Tailscale + NVIDIA driver on `graphics-machine`, Ollama systemd (`OLLAMA_HOST=0.0.0.0:11434`) on both hosts, model pulls per `task openclaw:ollama:check`.
   - First GitHub Actions deploy to a fresh Ubuntu install (hand-hold the initial run).
   - **Telegram tokens need to be re-provisioned for prod.** The bots in `.env` are dev-only; create a fresh BotFather set or reuse the existing tokens (one bot can't be in two long-poll instances at once, so either move them or make new ones for prod).
   - `task openclaw:auth:codex` (no `:local`) — same flow against prod compose.

### What landed this session

- **Local dev mode brought up end-to-end.** Nine agents, four Telegram bots, image+video gen, all five Honcho services healthy. First message from a Telegram bot to its lead agent works (cold-start ~30s, follow-ups much faster).
- **Ollama install cleaned up.** Two installs were fighting for port 11434 (Homebrew 0.17.0 + Ollama.app 0.22.0). Removed brew, `.app` is sole owner. Native Mac install at `/Applications/Ollama.app/`. Models in `~/.ollama/models/`.
- **Gemma 4 blocker resolved.** Root cause was Ollama version: `gemma4:e4b`'s manifest declares `requires 0.20.0`; brew's 0.17.0 rejected it. Pulled and aliased `gemma4-e4b-128k:latest` after upgrade.
- **`openclaw.json` schema fixed for current OpenClaw.** Removed the obsolete `models.providers.openai-codex` block (built-in pi-ai catalog provider, no entry needed) and the legacy `agents.defaults.llm.idleTimeoutSeconds` block. Added `imageGenerationModel` + `videoGenerationModel` so image/video generation works through the existing Codex OAuth without a separate API key.
- **Honcho URL rewrite for dev mode.** Prod gateway uses `network_mode: host` so `localhost:8000` reaches `honcho-api`; dev gateway uses bridge so `localhost` is the container loopback. `task openclaw:up:local` now sed-rewrites `localhost:8000` → `honcho-api:8000` when generating `openclaw.dev.json`.
- **OAuth + per-agent propagation scripted.** `scripts/openclaw-auth-codex.sh` runs `openclaw models auth login --provider openai-codex` → copies `auth-profiles.json` to all 9 per-agent dirs (without that step every agent fails with `No API key found for provider openai-codex`) → restarts gateway. Exposed as `task openclaw:auth:codex(:local)` and `auth:propagate(:local)`. The wizard expects URL-paste: callback to `localhost:1455` doesn't reach the gateway from a remote browser, so you copy the redirect URL from the failed page and paste it back into the wizard.
- **Workspaces verticalized.** Source layout is now `projects/openclaw/app/workspaces/<vertical>/<agent-id>/` — `development/`, `dnd/`, `email/`, `backpacking/`. Runtime workspace stays flat. The entrypoint discovers agents by walking for `SOUL.md` and reconciles against `agents.list[].id` (hard-fails on mismatch). New agents only require dropping a dir + adding the `agents.list[]` entry — no entrypoint edits.
- **Lead agents renamed to `<vertical>-main`.** `orchestrator → dev-main`, `dnd → dnd-main`, `email → email-main`, `backpacking → backpacking-main`. Specialists keep flat names (`devops`, `dnd-dm`, etc.). Friendly Names in `IDENTITY.md` (what users see in chat) unchanged.
- **Telegram bots wired.** Four bots (one per lead agent) configured via `channels.telegram.accounts.<id>` + `bindings[]` in `openclaw.json`. Tokens in `.env` (gitignored) referenced as `{ source, provider, id }` SecretRefs; passed through to the gateway container via `compose.yml` env block. `dmPolicy: "allowlist"` with the user's numeric ID at the top level of `channels.telegram` (not nested per account).
- **New canonical reference doc.** `projects/openclaw/.docs/standards/workspaces-pattern.md` covers the verticalized layout, the discover-and-reconcile pattern, the new-vertical / new-agent / rename checklists, and the Telegram bot setup with copy-paste-ready snippets. Capture future conventions here, not in CLAUDE.md.

### Known issues (parked, not blocking dev mode)

- **`qwen-coder-next-256k` doesn't support thinking-mode.** When the brain falls back to local Qwen, the request includes thinking parameters and Qwen rejects with HTTP 400 `"qwen-coder-next-256k" does not support thinking`. Currently masked because the brain isn't failing. Needs either thinking disabled on the fallback model or request-shaping that strips thinking on fallback. Not blocking until we actually need the fallback.
- **`down:local:clean` wipes per-agent auth.** The propagated `auth-profiles.json` files live in the `workspace` named volume; volume wipe = re-OAuth. Mitigation: just re-run `task openclaw:auth:codex:local`. Could be made more robust by setting `OPENCLAW_STATE_DIR=/workspace/.openclaw` in the gateway env so the wizard writes directly to the persistent volume, or by baking the propagate step into `entrypoint.sh` so it runs on every boot. Both are small.
- **Per-agent `skills/` subdirs are inert.** Each agent dir has a `skills/` folder, but the entrypoint only seeds persona files (SOUL/AGENTS/IDENTITY/etc.) — not per-agent skills. The global `/app/skills/` symlink is what's actually loaded. If we ever want per-agent skill scoping, the entrypoint needs an extra step.
- **Vision INPUT (uploading images for the agent to see) not exposed on Codex OAuth.** `openclaw models list` shows `Input: text` for `openai-codex/gpt-5.5`. Image GENERATION via `image_generate` works (it's a tool), but if you want to send the agent an image and have it discuss it, that's a different routing problem (route image-bearing turns to local Gemma 4, or add a separate OpenAI API-key path).
- **Pro 5× quota behavior for image/video generation is undocumented.** Whether `openai/gpt-image-2` and `openai/sora-2` count against the same Pro 5× quota as text or are metered separately isn't clear from the docs. Worth watching usage as you generate.
- **`~/.codex` bind-mount approach abandoned.** Earlier attempt to bypass OAuth by reading the laptop's Codex CLI tokens directly. Doesn't work — per docs, *"Onboarding no longer imports OAuth material from `~/.codex`. Sign in with browser OAuth (default) or the device-code flow above — OpenClaw manages the resulting credentials in its own agent auth store."* The bind-mount was removed from `compose.dev.yml`. Don't re-add it expecting it to work.

### Decisions not to re-litigate

(Carrying forward from prior sessions, still load-bearing.)

- **Multi-orchestrator (single gateway, lead-per-vertical) over multi-gateway** unless a hard-isolation trigger appears (e.g. real-time audio for the D&D voice prototype). See `ideas/agent-hierarchy.md`.
- **Three-tier model topology** stays (brain + local fallback + Tier-2 + embeddings). Don't consolidate. See `ideas/model-tiering-decision.md`.
- **No misleading aliases** when substituting models. If the planned model isn't available, change the config to use the real substitute name; don't alias the substitute under the planned name. Saved to memory.
- **Compaction stays on local Qwen** — async background workload, fits the OpenAI-for-thinking-local-for-async philosophy.
- **OpenAI-first by deliberate user choice.** Don't push specialists onto local primary "to save quota." User's stated position: observe real Pro 5× usage, escalate the subscription only if quota becomes a real problem.

### Working tree state

`git log --oneline -10` shows recent commits. The dev-mode + OAuth + verticalization + Telegram + image-gen work landed as one commit on `dev`. Prior CLAUDE.md detailed step descriptions (Step 0 through Step 4 + the "Decision rationale" block) were collapsed once the work shipped — check git history for the original wording if you need it.

## Current shape

`projects/openclaw/` is a **nine-agent, four-vertical** OpenClaw deployment running in **multi-orchestrator mode** — each domain has a user-facing lead with private specialists below it where the work warrants splitting. Every agent has its own workspace under `/workspace/.openclaw/workspaces/<id>/` containing `SOUL.md` (voice), `AGENTS.md` (rules + tools), `IDENTITY.md` (display metadata).

**Verticals:**

| Vertical | User-facing lead | Specialists | Status |
|---|---|---|---|
| Software development | `dev-main` 🎯 | `devops` 🛠, `worker` ⚙️, `tester` 🧪 | Active |
| Email | `email-main` 📬 (single-agent + skills) | — | Skeleton; needs IMAP/Gmail MCP |
| Backpacking | `backpacking-main` 🎒 (single-agent + skills) | — | Skeleton; needs maps MCP + inventory store |
| D&D 5e | `dnd-main` 🐉 | `dnd-dm` 🎲, `dnd-chargen` 🧙 | Skeleton; needs SRD vector index, dice roller, character store |

Lead agents follow a `<vertical>-main` naming convention; specialists keep flat names. Source files live under `projects/openclaw/app/workspaces/<vertical>/<agent-id>/`; runtime workspace at `/workspace/.openclaw/workspaces/<id>/` stays flat. The entrypoint discovers agents by walking for `SOUL.md` and reconciles against `agents.list[].id` in `openclaw.json`. See `projects/openclaw/.docs/standards/workspaces-pattern.md` for the full convention and the new-vertical / new-agent checklist.

Per-agent `subagents.allowAgents` enforces the delegation graph at config level (deny by default + `requireAgentId: true`). Today: `dev-main → [devops, worker, tester]`, `worker → [tester]` (mandatory verification handoff), `dnd-main → [dnd-dm, dnd-chargen]`, all other agents → `[]`. Decision record: `ideas/agent-hierarchy.md`. Portable pattern: `multi-agent-openclaw.md` (repo root).

**Model topology — three tiers + embeddings:**

| Role | Endpoint (prod) | Model | Notes |
|---|---|---|---|
| Brain (Tier-1) | OpenAI cloud, OAuth via ChatGPT Pro 5× | `openai-codex/gpt-5.5` | Primary for all agents. 1M native context; effective runtime cap ~195k under Pro 5× (observed via `openclaw models list`). Pro 5× exposes one model only — no mini variant. |
| Brain fallback (Tier-1 local) | `http://graphics-machine:11434` | `qwen-coder-next-256k` (Qwen3-Next 80B MoE / 3B active, Q4_K_M, 256K ctx) | Resilience only. Known issue: rejects requests with thinking-mode parameters; needs config fix before fallback can actually serve traffic. |
| Tier-2 fast | `http://host-machine:11434` | `gemma4-e4b-128k` (8B params, Q4_K_M, 128K ctx) | Honcho deriver + per-skill triage / classification / JSON extraction. Pulled and verified May 2026; aliased from `gemma4:e4b`. **Requires Ollama ≥ 0.20.0** (manifest declares it). |
| Embeddings | `http://host-machine:11434` | `bge-m3-8k` (BAAI, 1024-dim, 8K ctx) | QMD vector search + Honcho memory. Honcho hardcodes `openai/text-embedding-3-small`; aliased on host-machine to `bge-m3-8k`. Embeddings are NOT included in ChatGPT subscriptions, so the local model is non-optional. |

**Local dev mode** (the user's M1 laptop with native Ollama) collapses both Ollama endpoints to `host.docker.internal:11434`. Compose dev override + Taskfile `:local` targets handle this. Runbook: `projects/openclaw/.docs/playbooks.md` § "Operator playbook: local dev mode."

**Memory** is layered: **QMD** for local BM25/vector search over `.docs/` and session transcripts, **Honcho** (self-hosted Postgres+Redis+API+deriver, five compose services) for cross-session memory + cross-agent learning, plus per-agent runtime-state files in JSON for authoritative current state. Episodic facts → Honcho; current state → workspace JSON files. Don't conflate.

**Channels.** WebChat (built-in) + four Telegram bots, one per main agent: `dev-main-bot`, `dnd-main-bot`, `email-main-bot`, `backpacking-main-bot`. Multi-account via `channels.telegram.accounts.<id>` with `bindings[]` mapping each account to its agent. `dmPolicy: "allowlist"` with the user's numeric Telegram ID at the top level of `channels.telegram` gates DMs to a single owner. Bot tokens come from `.env` via SecretRefs (`{ source: "env", provider: "default", id: "TELEGRAM_BOT_TOKEN_*" }`); each token also needs a passthrough line in `compose.yml`'s gateway `environment:` block. Specialists (`devops`, `worker`, `tester`, `dnd-dm`, `dnd-chargen`) are reachable only via WebChat or via delegation from their lead.

**Image + video generation.** Enabled via `agents.defaults.imageGenerationModel.primary = "openai/gpt-image-2"` and `videoGenerationModel.primary = "openai/sora-2"`. Both flow through the existing Codex OAuth (no separate API key). Any agent can call `image_generate` / `video_generate` tools; the `dnd-main` agent in particular is the obvious user for character art.

**Auth.** OAuth profile for the brain is managed by OpenClaw itself (not env-based). The flow is wrapped by `task openclaw:auth:codex` (prod) / `task openclaw:auth:codex:local` (dev) — both call `scripts/openclaw-auth-codex.sh`, which runs the wizard, propagates `auth-profiles.json` from the main agentDir to each of the 9 per-agent dirs (without that step every agent fails with `No API key found for provider openai-codex`), then restarts the gateway. The wizard expects URL-paste: the OAuth callback at `localhost:1455` doesn't reach the gateway from a remote browser, so you sign in, copy the redirect URL from the failed-to-load page, and paste it back into the wizard. Env-based credentials in `.env`: `OLLAMA_API_KEY` (placeholder for the bundled Ollama provider plugin), `OPENCLAW_AUTH_TOKEN` (browser-to-gateway pairing), `GITHUB_APP_ID` + `GITHUB_APP_INSTALLATION_ID` (git-sync sidecar), and the four `TELEGRAM_BOT_TOKEN_*` vars. Honcho's LLM env vars (`LLM_OPENAI_COMPATIBLE_API_KEY`, `LLM_OPENAI_COMPATIBLE_BASE_URL`) are wired in compose from `OLLAMA_API_KEY` + a literal endpoint string.

References:
- `projects/openclaw/.docs/overview.md` — full deployment topology
- `projects/openclaw/.docs/playbooks.md` — agent + operator runbooks (incl. local dev mode + Pro 5× model surface)
- `projects/openclaw/.docs/standards/workspaces-pattern.md` — canonical doc for adding verticals/agents + Telegram bot setup. Capture future conventions here, not in CLAUDE.md.
- `infrastructure/.docs/hosts.md` — per-host inventory + post-move target state
- `multi-agent-openclaw.md` (repo root) — portable architecture pattern (export artifact)
- `scripts/openclaw-auth-codex.sh` — auth flow + propagation script (read the header comment)
- `ideas/agent-hierarchy.md`, `ideas/model-tiering-decision.md`, `ideas/dnd-5e-agents.md` — decision records
- `ideas/openclaw-local-llm-hybrid.md` — earlier history (single-tier local brain era)

## Division of labor

This repo has **two autonomous coding agents** plus a **frozen reference project**. Each has a clear scope:

| Agent / Project | Scope | How it's edited |
|---|---|---|
| **OpenClaw** (`projects/openclaw/`) | Owns **`projects/application/`** — the benchmark application (backend, frontend, keycloak, database). OpenClaw reads `.docs/` specs under `projects/application/` and syncs code to match. | Edited by **Claude Code** (here). When working on OpenClaw skills, prompt flows, or dockerfiles, rebuild the gateway image (`task openclaw:build`) and recreate the container (`task openclaw:restart` or `task openclaw:up`) to pick up changes. |
| **Claude Code** (this session, from the user's laptop) | Owns **`projects/openclaw/`** — OpenClaw's own configuration, skills, dockerfiles, taskfile. Also owns all cross-cutting concerns: `infrastructure/`, `scripts/`, `.github/`, `Taskfile.yml`, and this file. | Edited in this Claude Code session via the user's CLI. |
| **THE Dev Team** (`projects/the-dev-team/`) | **Frozen.** Kept as reference material only. Not runnable. Not actively worked on. | Do not edit. If you find yourself wanting to change something under `projects/the-dev-team/`, stop and reconsider — you almost certainly want to be editing `projects/openclaw/` or `projects/application/` instead. |

**Rule of thumb when deciding where work lands:**

- Is it a bug in the benchmark app (backend/frontend/keycloak/database)? → OpenClaw's queue. Open an issue or talk to `dev-main` at `http://<host-machine>:3001` (tailnet). Do not edit `projects/application/` directly from Claude Code unless it's a cross-cutting infra concern.
- Is it a change to how OpenClaw itself thinks or acts (skills, agent instructions, docker image, task wiring)? → Claude Code. Edit `projects/openclaw/` directly in this session.
- Is it infrastructure, CI/CD, or the deployment story? → Claude Code. Edit the relevant `infrastructure/`, `scripts/`, or `.github/` file.
- Is it anywhere under `projects/the-dev-team/`? → Don't.

## Documentation-Driven Development

This repo follows a docs-driven development approach. `.docs/` directories are the specification — the source of truth for what code should do. The delta between `.docs/` and code defines all work.

**Core principle:** If a feature is not documented, it doesn't exist. If it's documented incorrectly, it's broken.

## Finding Documentation

Documentation is colocated with the code it describes. Look for `.docs/` at the level you're working in:

### Repo-level (standards and conventions)

```
.docs/
├── overview.md                         # What this repo is, how it's organized
└── standards/
    ├── docs-driven-development.md      # The .docs/ convention itself (file types, rules)
    ├── feature-architecture.md         # Code lives in features/, not pages/endpoints
    ├── project-architecture.md         # Project structure patterns
    ├── environment-configuration.md    # .env and config patterns
    ├── task-automation.md              # Taskfile patterns
    └── diagrams.md                     # Mermaid (primary) + ASCII (quick sketches)
```

### Infrastructure

```
infrastructure/.docs/
├── overview.md                         # Index for this directory
└── ecosystem.md                        # Host roles, deploy flow, diagrams — the north star
infrastructure/compose/.docs/
└── overview.md                         # Compose stack layout, ports, env files, sandboxes
```

### CI/CD

```
.github/.docs/
├── overview.md                         # What CI/CD does, deployment model
├── spec.md                             # Triggers, secrets, services, steps
└── decisions.md                        # Why branch-based deploys, etc.
```

### Project-level

```
projects/{project}/{app}/.docs/
├── overview.md                         # What this project is, tech stack
└── standards/
    ├── coding.md                       # Code patterns, naming, structure
    └── design.md                       # Visual design spec (frontend only)
```

### Feature-level

`.docs/` lives **inside** the feature directory, not in some sibling or root folder. The exact depth of the `features/` directory depends on the project's framework conventions — **always confirm by looking at a sibling feature's `.docs/` before creating a new one.**

Per-project feature paths currently in use:

| Project | Feature directory |
|---------|-------------------|
| `projects/application/frontend/` (Angular) | `app/src/app/features/{feature}/` |
| `projects/application/backend/` (NestJS) | `app/src/features/{feature}/` |
| `projects/openclaw/` | N/A — single app, feature docs live in `.docs/` directly |

`projects/the-dev-team/` is frozen reference material and should not have new feature docs.

Inside each feature, `.docs/` contains:

```
features/{feature}/.docs/
├── spec.md                             # WHAT to build (always required)
├── flows.md                            # HOW it works step-by-step
├── contracts.md                        # API shapes, event schemas
├── test-plan.md                        # HOW to verify it works
├── test-data.md                        # WITH what data to test
└── decisions.md                        # WHY it's this way
```

**Never** place feature docs at the repo root (`.docs/features/...`) — the root `.docs/` is reserved for repo-level standards and overview. Feature docs colocate with feature code.

## How to Use .docs/

1. **Before modifying code** — read the `.docs/` at that level to understand what the code should do
2. **Before adding a feature** — write the spec first, then implement to match it
3. **When confused about architecture** — check `.docs/standards/` at the repo level
4. **When working on infrastructure** — check the `.docs/` colocated with that subsystem

## Key Conventions

- `spec.md` describes observable behavior, not implementation details
- `contracts.md` is the bridge between frontend and backend
- `test-plan.md` maps back to acceptance criteria in the spec
- Standards in `.docs/standards/` apply to everything below that directory
- The full DDD standard is at `.docs/standards/docs-driven-development.md`
