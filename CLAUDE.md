# CLAUDE.md

## Current shape

`projects/openclaw/` is a four-agent OpenClaw deployment. Each agent
(orchestrator 🎯, devops 🛠, worker ⚙️, tester 🧪) has its own
workspace under `/workspace/.openclaw/workspaces/<id>/` containing
`SOUL.md` (voice), `AGENTS.md` (rules + tools), `IDENTITY.md` (display
metadata). All four reason via the same self-hosted Ollama topology:

| Role | Machine | Model | Endpoint |
|---|---|---|---|
| Agent brain | `graphics-machine` (Windows + RTX 2080 Ti, 96 GB RAM) | `qwen-coder-next-256k` — derivative of `frob/qwen3-coder-next:80b-a3b-q4_K_M` (Qwen3-Next 80B MoE / 3B active, Q4_K_M, 256K ctx) | `http://graphics-machine:11434` |
| Memory embeddings | `host-machine` (Mac mini, Ubuntu) | `bge-m3-8k` — derivative of `bge-m3` (BAAI, 1024-dim, 8K ctx) | `http://host-machine:11434` |
| Honcho derivation/summary/dialectic | `host-machine` | `qwen-coder-32k` — derivative of `qwen2.5-coder:32b-instruct-q6_K`, 32K ctx, CPU-only | `http://host-machine:11434/v1` |

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
