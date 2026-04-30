# CLAUDE.md

## Pick up here next session

The user is mid-stride on a planned expansion of OpenClaw. **Both machines were powered down for a household move AND will be rebuilt before they come back online** — this isn't just a "boot them up and verify" situation. See step 0 below.

Once both machines are healthy on the tailnet and Ollama responds on each (`curl http://graphics-machine:11434/api/tags`, same on host-machine), the agreed work for the next session is four things:

### 0. Rebuild both machines on Ubuntu

This happens on the user's hardware before any repo work. Claude Code's role is to **help the user verify the result and re-deploy OpenClaw** once the OSes are back up — not to drive the OS installs themselves.

- **`host-machine` (Mac mini)** — full reformat to Ubuntu. The Mac mini was already running Ubuntu, but the user wants a clean rebuild while everything is offline.
- **`graphics-machine` (gaming PC, RTX 2080 Ti, 96 GB RAM)** — moving off Windows to Ubuntu. Ubuntu lives on an **external OWC Envoy Pro FX 2TB Thunderbolt 3 / USB 3.2 SSD** (~2800 MB/s over TB3, ~1000 MB/s over USB 3.2 Gen 2 fallback). Windows stays on the internal drive untouched. BIOS boot order: external first, internal Windows second — fall-through dual-boot. Plug the drive in → Ubuntu; unplug → Windows for gaming.
- The graphics-machine swap is the bigger change. Things the next session should verify, in order:
  - Tailscale joined the tailnet under the same `graphics-machine` MagicDNS name (otherwise the gateway env vars and `infrastructure/compose/openclaw/*.yml` references break).
  - NVIDIA driver installed and `nvidia-smi` reports the RTX 2080 Ti. Ubuntu 24.04 + `nvidia-driver-535` (or whatever the current LTS-supported branch is) + CUDA 12.x is the known-good combo for Turing.
  - Ollama installed via the official Linux script, exposed on `0.0.0.0:11434` (the systemd unit's `OLLAMA_HOST` env var — not the default `127.0.0.1`), with Tailscale ACLs allowing host-machine and the user's laptop.
  - `frob/qwen3-coder-next:80b-a3b-q4_K_M` re-pulled and aliased back to `qwen-coder-next-256k` via `ollama cp`. ~50GB pull — let the user kick this off; just verify when done.
  - Same Ollama setup on host-machine, plus `bge-m3` re-pulled and aliased as both `bge-m3-8k` and `openai/text-embedding-3-small` (Honcho hardcodes the latter name).
- **Update `infrastructure/.docs/hosts.md`** to reflect the OS swap and the external-drive boot story for graphics-machine. The Windows-era entry is now history.
- Once both endpoints respond, redeploy the OpenClaw stack via `task openclaw:up` from the user's laptop. The compose project itself targets host-machine via the GitHub Actions deploy, so a push to `dev` triggers the redeploy — but on a fresh Ubuntu install the first deploy may need manual hand-holding (Docker installed, `host-machine` passwordless SSH for the deploy workflow, GitHub App PEM file restored to the right path).

### 1. Wire OpenAI Codex (ChatGPT subscription) as the agent brain

This is the highest-leverage change in the batch. Moves the four core agents (orchestrator, devops, worker, tester) off local Qwen3-Coder-Next as their primary and onto **`openai-codex/gpt-5.5`** via OAuth from the user's existing **ChatGPT Pro 5× subscription** ($100/mo tier). The local Qwen3-Coder-Next install stays as the resilience fallback.

OpenClaw ships first-class subscription auth — no proxy, no `~/.codex` scraping. Reference: `.claude/skills/openclaw/reference/llms-full.txt:74473-74691` (or live at `docs.openclaw.ai/providers/openai`).

User's stated philosophy (capture verbatim so future-you doesn't drift): **"route all of the real thinking to OpenAI and use the local LLMs for embeddings, async tasks that run in the background, and as small worker agents that get stuff done if need be. My primary focus will be using OpenAI and I'll select to use local models sparingly. If I start running into limits then I'll make changes or up my subscription."** Don't pre-optimize for Pro 5× rate limits — wire it OpenAI-first as described and let the user observe real usage before tuning.

Concrete tasks:
- Run OAuth onboarding from inside the gateway container (it's headless on host-machine, so use device-code flow):
  ```
  openclaw onboard --auth-choice openai-codex --device-code
  ```
  Or if the gateway is already running and just needs auth added:
  ```
  openclaw models auth login --provider openai-codex --device-code
  ```
- In `projects/openclaw/app/openclaw.json`, add an `openai-codex` provider entry under `models.providers`, set `agents.defaults.model.primary` to `openai-codex/gpt-5.5`, and configure each of the four core agents with `openai-codex/gpt-5.5` primary and `ollama/qwen-coder-next-256k` as the single fallback. Keep the `ollama` provider block exactly as it is — it's now the fallback, not the primary.
- Default runtime context cap is 272k (out of native 1M). Don't override unless an actual context-overflow case shows up — OpenClaw's docs say 272k has better latency/quality than 1M.
- Update `projects/openclaw/.docs/overview.md` model topology section to reflect OpenAI Codex as the primary brain and Qwen3-Coder-Next as the local resilience fallback.
- Verify with a smoke test: send a message to orchestrator, confirm the response shows `openai-codex/gpt-5.5` in the session metadata or chat `/status`. Then deliberately exercise fallback (revoke the token, or block the OpenAI endpoint at the firewall) and confirm fallback to local Qwen3-Coder-Next works.

### 2. Add a Tier-2 fast model on `host-machine`

Today, host-machine runs only embeddings (`bge-m3`) and the Honcho deriver (`qwen2.5-coder:32b-instruct-q6_K` — oversized and CPU-slow for what Honcho's deriver actually does). The plan is to add a **second small instruct model** alongside the existing two — call it the **Tier-2** model — for fast routing, classification, JSON extraction, and Honcho's deriver workload. Tier-2 is for **async background work and trivial classification** — it's not in the agent reasoning hot path (that's OpenAI Codex per Step 1).

Target model: **`gemma4:e4b`** (Gemma 4 E4B, ~4.5B effective params, 128K ctx, native structured JSON output, Apache 2.0). Pulled via Ollama on host-machine. Reasoning for picking this specific model is captured in [`ideas/model-tiering-decision.md`](#) — write that doc as part of the work if it doesn't exist; the bullet points are below in "Decision rationale."

Concrete tasks:
- Pull `gemma4:e4b` on host-machine (`ollama pull gemma4:e4b`).
- Decide and document an alias the way the existing models are aliased (e.g. `gemma4-e4b-128k`). Update `infrastructure/.docs/hosts.md` to list the new model.
- Add a Tier-2 endpoint env var (likely `OLLAMA_TIER2_BASE_URL` + `OLLAMA_TIER2_MODEL`) to OpenClaw's gateway env. The brain endpoint stays exactly as is.
- Repoint Honcho's deriver from `qwen-coder-32k` to the new Tier-2 alias by changing the `OPENAI_COMPATIBLE_BASE_URL` model name in `infrastructure/compose/openclaw/`. Keep `qwen-coder-32k` installed as a fallback for the moment — don't delete it.
- Update `projects/openclaw/.docs/overview.md` with the new three-tier topology (brain + Tier-2 + embeddings).
- Rebuild the gateway image (`task openclaw:build`) and recreate (`task openclaw:restart`).
- **Verify** by sending a smoke-test message to the orchestrator and confirming the deriver runs against the new model (check Honcho logs).

### 3. Skeleton for the email agent

User wants a generic skeleton — **do not over-implement**. He'll iterate on it himself.

Create `/workspace/.openclaw/workspaces/email/` with the same three files every existing workspace has:
- `SOUL.md` — voice/persona, generic for now ("helps the user triage email, surface what's important, never miss a thread that matters")
- `AGENTS.md` — rules + tools, with placeholder tool list (note that an IMAP/Gmail MCP server will be needed but is **not in scope for this session** — leave a TODO)
- `IDENTITY.md` — display metadata (name, emoji, color)

Pick an emoji that doesn't clash with the existing four (🎯🛠⚙️🧪). 📬 or 📨 are obvious choices.

Wire the agent into the OpenClaw config (the same place the existing four agents are registered) and verify the orchestrator can see it. **Skills are deliberately empty for now** — user will write `triage_inbox`, `extract_action_items`, `draft_reply` himself, with the first two routed to Tier-2 (Gemma 4 E4B on host-machine) and the third to the OpenAI Codex brain. Just leave a `skills/` directory with a README placeholder noting that routing convention.

Also create a Honcho workspace for cross-session email facts (per-user-mentioned-people, recurring senders, etc.) and a QMD index stub. Don't ingest any real email data yet — that's the user's task.

### 4. Skeleton for the backpacking agent

Same shape as the email agent. `/workspace/.openclaw/workspaces/backpacking/`. Generic SOUL/AGENTS/IDENTITY. Note in `AGENTS.md` that this agent will eventually need a maps MCP server (Caltopo / Gaia / similar) and an inventory store, but **neither is in scope for this session**. Empty `skills/` with a README.

Pick an emoji — 🎒 is the obvious choice.

Honcho workspace + QMD index stub, same as email.

### Decision rationale (so you don't second-guess)

These decisions came from a deep research pass and a model-attributes crash course. **Don't re-litigate them** unless something has materially changed (new Gemma 4 Coder release, Ollama tool-parser fixes for Gemma 4, new Qwen release). Briefly:

- **Brain becomes `openai-codex/gpt-5.5`** via the user's ChatGPT Pro 5× subscription, OAuth'd through OpenClaw's first-class `openai-codex` provider. Frontier coding capability + best-in-class tool-call reliability + no per-token billing on the subscription path. **Qwen3-Coder-Next 80B-A3B stays installed on graphics-machine as the local resilience fallback** — it's still the strongest local agentic-coding model and was the right Tier-1 pick before OpenClaw shipped subscription auth. The MoE-on-modest-hardware property (3B active / 80B total, paging from 96 GB RAM) is what lets the fallback exist on this box at all.
- **OpenAI-first by deliberate choice.** All four core agents (orchestrator, devops, worker, tester) get OpenAI Codex as primary. Local models are reserved for embeddings (`bge-m3`), async background work (Honcho deriver on Gemma 4 E4B), and small classification/router skills inside the new agents. Don't push devops/tester onto local primary "to save quota" — the user's explicit position is OpenAI-first, observe real usage, escalate the subscription if quota becomes a real problem.
- **Tier-2 is `gemma4:e4b`** because Honcho's deriver is a short, frequent, JSON-emitting summarization workload — the 32B coder model on Mac mini CPU is wildly oversized for this and runs at ~5 tok/s. Gemma 4 E4B will hit 30-60 tok/s on the same box, has native structured JSON output, and Apache 2.0. The same model also serves as a general fast-path for any agent skill that needs cheap classification or routing.
- **MoE is the load-bearing architectural choice** for the brain on this hardware (RTX 2080 Ti, 11 GB VRAM, 96 GB RAM). Qwen3-Next-80B has 3B active params per token; experts page from system RAM. A 30B-class dense model would be unusable on this box. Any future brain swap must also be MoE.
- **Two-tier topology, not consolidation.** Brain and Tier-2 are different workloads (long agentic loops vs short summarization bursts). Don't try to make one model do both.
- **Memory: extend, don't rebuild.** QMD (BM25/vector RAG layer) and Honcho (cross-session structured-memory layer) already cover what new agents need. New agents get new Honcho workspaces and new QMD indexes — no new memory infrastructure.
- **Routing happens at the skill level**, not the agent level. An agent might call Tier-2 for classification and the brain for synthesis within the same task. OpenClaw skills should be able to target a model endpoint explicitly.

### What's explicitly out of scope this session

- Implementing actual email or backpacking skills (user will iterate).
- Adding the Gmail/IMAP MCP server.
- Adding the maps MCP server.
- Removing the `qwen2.5-coder:32b` deriver model from host-machine (keep it as fallback for now).
- Removing the `qwen3-coder-next:80b-a3b` install from graphics-machine — it stays as the local resilience fallback brain.
- Per-skill model routing inside email/backpacking agents (the skeletons just note the routing convention; user will wire skill-level overrides himself when implementing).
- Anything under `projects/the-dev-team/` (frozen, see Division of Labor below).

## Current shape

`projects/openclaw/` is a four-agent OpenClaw deployment. Each agent
(orchestrator 🎯, devops 🛠, worker ⚙️, tester 🧪) has its own
workspace under `/workspace/.openclaw/workspaces/<id>/` containing
`SOUL.md` (voice), `AGENTS.md` (rules + tools), `IDENTITY.md` (display
metadata). The planned model topology routes all four agents' reasoning
to OpenAI Codex via the user's ChatGPT Pro 5× subscription, with the
self-hosted Ollama stack as resilience fallback + supporting roles:

| Role | Machine | Model | Endpoint |
|---|---|---|---|
| Tier-1 agent brain (planned primary) | (OpenAI cloud, OAuth via user's ChatGPT Pro 5×) | `openai-codex/gpt-5.5` — Codex subscription route, 1M native context capped at 272k runtime for latency/quality | OpenAI Responses API; OAuth tokens managed by OpenClaw's `openai-codex` provider |
| Tier-1 local fallback (resilience) | `graphics-machine` (Ubuntu on external OWC Envoy Pro FX 2TB TB3 SSD, dual-boot fall-through to internal Windows for gaming; RTX 2080 Ti, 96 GB RAM) | `qwen-coder-next-256k` — derivative of `frob/qwen3-coder-next:80b-a3b-q4_K_M` (Qwen3-Next 80B MoE / 3B active, Q4_K_M, 256K ctx) | `http://graphics-machine:11434` |
| Tier-2 fast model *(planned, not yet deployed)* | `host-machine` (Mac mini, Ubuntu) | `gemma4:e4b` (Gemma 4 E4B, ~4.5B effective, 128K ctx, native JSON, Apache 2.0) — for triage, classification, JSON extraction, Honcho deriver | `http://host-machine:11434` |
| Memory embeddings | `host-machine` | `bge-m3-8k` — derivative of `bge-m3` (BAAI, 1024-dim, 8K ctx) | `http://host-machine:11434` |
| Honcho derivation/summary/dialectic | `host-machine` | currently `qwen-coder-32k` — `qwen2.5-coder:32b-instruct-q6_K`, 32K ctx, CPU-only. **Planned to repoint to Tier-2 (`gemma4:e4b`)** — keep `qwen-coder-32k` installed as fallback. | `http://host-machine:11434/v1` |

Memory is layered: **QMD** for local BM25/vector search over `.docs/`
and session transcripts, **Honcho** (self-hosted Postgres+Redis+API+
deriver) for cross-session memory and cross-agent learning via auto-
extracted conclusions, plus a builtin SQLite fallback. The Honcho
stack runs as five compose services in `infrastructure/compose/openclaw/`.

Cloud APIs are not used. The only env-based credential for the agent
runtime is `OLLAMA_API_KEY` (a non-empty placeholder OpenClaw requires
to activate the bundled Ollama provider plugin). Honcho's own LLM
calls route through `OPENAI_COMPATIBLE_BASE_URL` to host-machine's
Ollama; embeddings use the same endpoint via Ollama's OpenAI-compat
shim, with `bge-m3-8k` aliased on host-machine as
`openai/text-embedding-3-small` (the model name Honcho hardcodes).

References:
- `projects/openclaw/.docs/overview.md` — agent personas, memory stack, Honcho config
- `infrastructure/.docs/ecosystem.md` — ecosystem map (host roles, deploy flow)
- `infrastructure/.docs/hosts.md` — concrete per-host inventory (specs, installed Ollama models)
- `ideas/openclaw-local-llm-hybrid.md` — design rationale + hardware inventory (history)

## Division of labor

This repo has **two autonomous coding agents** plus a **frozen reference project**. Each has a clear scope:

| Agent / Project | Scope | How it's edited |
|---|---|---|
| **OpenClaw** (`projects/openclaw/`) | Owns **`projects/application/`** — the benchmark application (backend, frontend, keycloak, database). OpenClaw reads `.docs/` specs under `projects/application/` and syncs code to match. | Edited by **Claude Code** (here). When working on OpenClaw skills, prompt flows, or dockerfiles, rebuild the gateway image (`task openclaw:build`) and recreate the container (`task openclaw:restart` or `task openclaw:up`) to pick up changes. |
| **Claude Code** (this session, from the user's laptop) | Owns **`projects/openclaw/`** — OpenClaw's own configuration, skills, dockerfiles, taskfile. Also owns all cross-cutting concerns: `infrastructure/`, `scripts/`, `.github/`, `Taskfile.yml`, and this file. | Edited in this Claude Code session via the user's CLI. |
| **THE Dev Team** (`projects/the-dev-team/`) | **Frozen.** Kept as reference material only. Not runnable. Not actively worked on. | Do not edit. If you find yourself wanting to change something under `projects/the-dev-team/`, stop and reconsider — you almost certainly want to be editing `projects/openclaw/` or `projects/application/` instead. |

**Rule of thumb when deciding where work lands:**

- Is it a bug in the benchmark app (backend/frontend/keycloak/database)? → OpenClaw's queue. Open an issue or talk to the orchestrator at `http://<host-machine>:3001` (tailnet). Do not edit `projects/application/` directly from Claude Code unless it's a cross-cutting infra concern.
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
