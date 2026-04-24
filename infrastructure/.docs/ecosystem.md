# Ecosystem

Top-level map of what runs where, how code flows from the laptop to the
deploy target, and how a task flows through OpenClaw to a PR.

## Actors

| Actor | Role | How it's edited |
|---|---|---|
| **Dev laptop** | Where a human drives Claude Code, opens PRs, reviews OpenClaw output | — |
| **GitHub** (`ArchiCain/automated-coding-agent`) | Source of truth + GHCR registry + Actions runners | — |
| **CI runner** (ephemeral, GitHub-hosted) | Builds images, joins tailnet, calls `scripts/deploy.sh` | `.github/workflows/` |
| **host-machine** (always-on Ubuntu, tailnet) | Runs the compose stack (app + OpenClaw + sandboxes) + embedding/fallback LLM | Edited indirectly — code is shipped via CI deploy |
| **graphics-machine** (intermittent Ubuntu, tailnet, GPU) | Serves the primary coding LLM via Ollama | Out of scope for this repo — configured out-of-band |

Tailscale assigns the actual hostnames for host-machine and graphics-machine;
docs refer to them by role.

## System at a glance

```mermaid
flowchart LR
  subgraph Internet["🌐 Internet"]
    GH["GitHub<br/>ArchiCain/automated-coding-agent<br/>+ GHCR registry"]
    CI["GH Actions runner<br/>(ephemeral)"]
  end

  subgraph Tailnet["🔒 Tailnet"]
    LAPTOP["Dev laptop<br/>Claude Code"]

    subgraph HOST["host-machine (always-on, CPU)"]
      OCG["OpenClaw gateway<br/>:3001"]
      GS["git-sync sidecar<br/>clones + polls dev"]
      APP["dev compose stack<br/>frontend:3000<br/>backend:8080<br/>keycloak:8081<br/>postgres (internal)"]
      SB["sandboxes<br/>env-* compose projects"]
      OLC["Ollama :11434<br/>bge-m3 (embeds)<br/>qwen-coder-32k (fallback)"]
    end

    subgraph GPU["graphics-machine (intermittent, GPU)"]
      OLG["Ollama :11434<br/>qwen-coder-72b (primary)"]
    end
  end

  LAPTOP -- "git push / PR" --> GH
  GH -- "workflow_dispatch" --> CI
  CI -- "build + push images" --> GH
  CI -- "tailscale join + ssh deploy" --> HOST
  GS -- "pull dev" --> GH
  OCG -- "LLM primary" --> OLG
  OCG -- "LLM fallback" --> OLC
  OCG -- "memory embed" --> OLC
  OCG -- "docker socket" --> SB
  OCG -. "manages app stack" .-> APP
```

## Runtime: how a task flows through the system

When a human drops a task into OpenClaw, the four agents collaborate on a
feature branch, each writing to the parts of the repo they own (see
`CLAUDE.md` and `projects/openclaw/.docs/overview.md`).

```mermaid
sequenceDiagram
  autonumber
  actor Human
  participant Orch as orchestrator
  participant DevOps as devops
  participant Worker as worker
  participant Tester as tester
  participant Sandbox as sandbox<br/>(env-X)
  participant GH as GitHub

  Human->>Orch: "Add feature X"
  Orch->>Orch: Author / refine .docs/features/X/
  Orch->>DevOps: spin up sandbox for feat/X
  DevOps->>Sandbox: task env:create -- X
  DevOps->>GH: create feat/X branch
  Orch->>Worker: implement X against its spec
  Worker->>Sandbox: code + commit to feat/X
  Worker->>Tester: ready for tests
  Tester->>Sandbox: Playwright + API tests
  Tester-->>Worker: failures / pass
  Worker-->>Orch: feat/X green
  Orch->>GH: PR feat/X → dev
  GH-->>Human: PR for review
```

Stream A (orchestrator authoring docs/config) commits directly to `dev` —
no PR, just chat review. Stream B (feature work) is the flow above.

## Deploy flow

Deployment is explicit, not automatic — the dev branch is OpenClaw's
working branch and gets deployed to host-machine only when a human dispatches
the workflow.

```mermaid
sequenceDiagram
  autonumber
  actor Human
  participant GH as GitHub
  participant CI as CI runner<br/>(ubuntu-latest)
  participant GHCR as GHCR<br/>(image registry)
  participant Host as host-machine

  Human->>GH: workflow_dispatch "Deploy to dev"
  GH->>CI: start run (matrix: backend, frontend, keycloak, openclaw-gateway, openclaw-git-sync)
  CI->>CI: build each image (linux/amd64)
  CI->>GHCR: push {sha} + latest tags (auth: GITHUB_TOKEN)
  CI->>CI: tailscale up (ephemeral tag:ci node)
  CI->>Host: rsync infrastructure/compose/ + scripts/ghcr-login.sh → /srv/aca/
  Host->>Host: ghcr-login.sh: mint App installation token → docker login ghcr.io
  Host->>GHCR: docker compose pull (auth: App token)
  Host->>Host: docker compose up -d
  Host->>Host: docker logout ghcr.io (no creds left)
  Host-->>CI: containers up
  CI-->>GH: run ✅
```

The host reads from `/srv/aca/infrastructure/compose/{dev,openclaw}/`.
`.env` files on the host stay put between deploys; only the compose
files are rsynced. First-time setup is manual (see "Bootstrapping a host"
below).

## Components and where they live

| Component | Directory | Purpose |
|---|---|---|
| Benchmark app — frontend | `projects/application/frontend/` | Angular SPA; what OpenClaw builds features into |
| Benchmark app — backend | `projects/application/backend/` | NestJS REST + Socket.IO |
| Benchmark app — keycloak | `projects/application/keycloak/` | OIDC provider for the app |
| Benchmark app — database | `projects/application/database/` | Postgres (shared across compose + sandboxes) |
| OpenClaw gateway | `projects/openclaw/` | The agent runtime; edited by Claude Code, not by OpenClaw |
| The Dev Team | `projects/the-dev-team/` | Frozen. Prior orchestrator. Don't edit. |
| Dev compose stack | `infrastructure/compose/dev/` | Long-lived stack — app + keycloak + postgres |
| OpenClaw compose stack | `infrastructure/compose/openclaw/` | Gateway + git-sync sidecar |
| Sandbox compose template | `infrastructure/compose/sandbox/` | Per-task `env-{id}` clone of the dev stack |
| Deploy script | `scripts/deploy.sh` | rsync + ssh + compose pull/up for a tailnet host |
| Sandbox scripts | `scripts/sandbox-*.sh` | Lifecycle wrappers called by `task env:*` |
| CI workflows | `.github/workflows/` | `ci.yml` (PR checks), `deploy-dev.yml` (dispatch-only deploy) |

## Bootstrapping a host

First-time setup on host-machine (one-off, done by a human over SSH):

1. Install Docker Engine + `docker compose` plugin. (`openssl`, `curl`,
   and `rsync` are needed too; they're in Ubuntu by default.)
2. Install and authenticate Tailscale (`tailscale up`). Note the
   hostname — this goes in `vars.DEPLOY_HOST` on GitHub.
3. Create the deploy target directories: `sudo install -d -o $USER
   /srv/aca/infrastructure/compose /srv/aca/scripts`.
4. Place the per-compose-project `.env` files:
   - `/srv/aca/infrastructure/compose/dev/.env`
   - `/srv/aca/infrastructure/compose/openclaw/.env`
   See each directory's `.env.template` for the variable set.
5. Place the GitHub App private-key PEM at the host path referenced by
   `GITHUB_APP_PRIVATE_KEY_HOST_PATH` in the openclaw `.env`.
6. In GitHub repo settings → Variables, set `DEPLOY_HOST` to the tailnet
   hostname from step 2 (and `DEPLOY_USER` if the SSH user is not `ubuntu`).
7. Dispatch `Deploy to dev` from the Actions tab.

No `docker login ghcr.io` needed here — the deploy script mints a
short-lived GitHub App installation token on the host at deploy time
(`scripts/ghcr-login.sh`) using the App creds already in the openclaw
`.env`. It runs `docker login`, pulls, and logs out at the end of each
run, leaving no credentials on disk.

### GitHub App permission needed

The App must have **Packages: Read** permission on this repo's GHCR
packages (in addition to whatever it already has for the git-sync
sidecar — typically Contents: Read + Metadata: Read). Without Packages:
Read, `docker pull` will 403 even though login succeeded.

graphics-machine setup is out-of-band — Ollama installed as a systemd
service, models pulled, tailnet-joined. See `ideas/openclaw-local-llm-hybrid.md`
for the running notes.

## What lives where in docs

```
.docs/
├── overview.md                           # Repo-level map — points here
└── standards/
    ├── docs-driven-development.md
    ├── feature-architecture.md
    ├── project-architecture.md
    ├── environment-configuration.md
    ├── task-automation.md
    └── diagrams.md

infrastructure/.docs/
├── overview.md                           # Index for this directory
└── ecosystem.md                          # ← You are here

infrastructure/compose/.docs/
└── overview.md                           # Compose stack layout, ports, sandboxes

.github/.docs/
├── overview.md                           # CI + deploy workflows
├── spec.md                               # Workflow triggers, secrets, services
└── decisions.md                          # Why dispatch-only deploy, etc.

projects/{project}/{service}/.docs/
├── overview.md                           # What this service is, tech stack
├── standards/                            # Per-project conventions
└── features/{feature}/.docs/             # Spec, flows, contracts, test-plan
```
