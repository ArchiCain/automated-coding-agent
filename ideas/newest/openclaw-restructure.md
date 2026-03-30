# RLM to OpenClaw Restructure

## Overview

Replace the custom RLM orchestration system (shell scripts, tmux, file locks, coding-agent NestJS backend) with OpenClaw as the runtime engine. The existing decomposition logic and prompt templates carry forward as OpenClaw skills. Coding work is performed by **Claude Code** (for complex tasks via Anthropic API) and **OpenCode** (for volume work via self-hosted LLMs), both invoked via OpenClaw's ACP (Agent Client Protocol).

The coding-agent project (`projects/coding-agent/`) and all shell scripts (`scripts/`) are deprecated by this restructure.

---

## Architecture

### Host: Mac Mini

- 2018 Mac Mini (6-core i7, 64GB RAM, 2TB SSD)
- OS: Ubuntu Server 24.04 LTS
- Networking: Tailscale mesh + split DNS (`*.mac-mini`)

### Runtime Stack

OpenClaw runs inside K3s as a Deployment — same pattern as the coding-agent-backend it replaces. Same Nix-based Docker image, same Helmfile deploy, same secrets flow.

```
Mac Mini K3s Cluster
|
+-- app namespace (existing, unchanged)
|   +-- database, backend, frontend, keycloak, docs
|
+-- openclaw namespace (replaces coding-agent)
|   +-- openclaw-gateway (Deployment)
|       +-- OpenClaw Gateway daemon
|       +-- Claude Code CLI (ACP sessions for coding tasks)
|       +-- OpenCode CLI (future, for self-hosted LLM tasks)
|       +-- git, go-task, gh CLI
|       +-- Skills (SKILL.md files baked into image)
|       +-- Secrets: ANTHROPIC_API_KEY, CLAUDE_CODE_OAUTH_TOKEN,
|       |           GITHUB_TOKEN, OPENCLAW_AUTH_TOKEN
|       +-- Workspace PVC (50Gi)
|       +-- Built-in Web UI (chat, monitoring, config, approvals)
|       +-- Ingress: openclaw.mac-mini (Web UI + webhook receiver, Tailscale only)
|
+-- GitHub Actions (CI — builds, deploys, runs integration/E2E tests)
|   +-- Builds Docker image, pushes to mac-mini:30500
|   +-- Helmfile applies to K3s
|   +-- Runs full test suite per PR
|
+-- Docker Compose (local development)
    +-- openclaw-gateway service (same image, mounts repo as /workspace)
```

### Deployment Model

Identical to every other service in this repo:
1. Merge to `mac-mini` branch
2. GitHub Action (ubuntu-latest) connects to Mac Mini via Tailscale
3. Builds Docker image, pushes to in-cluster registry (`mac-mini:30500`)
4. Helmfile applies, pod rolls out
5. Secrets flow from `ENV_FILE_MAC_MINI` -> `.env` -> Helmfile -> K8s Secret -> pod env vars

### Key Decisions

- **OpenClaw runs in K8s** (not native systemd) — same deploy pattern as all other services
- **No separate Docker sandbox** — the K8s pod IS the container isolation
- **No Squid proxy needed** — K8s NetworkPolicy can restrict egress if needed later
- **CI is the integration test environment** — Claude Code runs unit tests inside the pod, CI handles integration/E2E
- **Dual coding agent strategy** — Claude Code for complex tasks (Anthropic API), OpenCode for volume work (self-hosted LLMs, future)
- **Deployed via merge-to-mac-mini** — same pipeline, same patterns, same secrets flow
- **Local dev via Docker Compose** — same as every other service
- **OpenClaw is part of the environment, not a separate system** — see Environment Model below

### Environment Model

An environment is the app stack + an OpenClaw agent that manages and tests it. Production is the exception — no agent, human operated.

```
Environment = App Stack + OpenClaw Agent (non-prod only)

dev/mac-mini:  app namespace + openclaw namespace
staging:       app namespace + openclaw namespace (if client requires)
production:    app namespace only (no agent)
```

**Default setup**: A single dev environment with one OpenClaw instance. This is the typical project lifecycle — develop in dev, deploy to production when ready. No multi-environment overhead unless needed.

**Multi-environment flexibility**: The Helmfile and Helm chart are environment-aware by design. Adding OpenClaw to a new environment requires no code changes — just environment config. Clients who need staging, QA, or other environments get an OpenClaw instance alongside the app automatically.

**Excluding production** is a single line in the Helmfile:

```yaml
- name: openclaw-gateway
  namespace: openclaw
  installed: {{ ne .Environment.Name "prod" }}
  # ... rest of release config
```

Each OpenClaw instance is scoped to its environment:
- Reads/writes to its own workspace PVC
- Reaches app services in the same cluster via K8s DNS
- Has its own Web UI accessible via Tailscale (e.g., `openclaw.dev`, `openclaw.staging`)
- Runs E2E tests against the app deployment next to it
- Has its own secrets (different API keys per environment if needed)

This pattern works because OpenClaw is just another Helm release in the environment definition. It follows the same deploy, scale, and teardown lifecycle as the app it manages.

---

## Pipeline: Git-Native Workflow

No external PM tools (no Jira). Everything lives in git. Two human gates: one after decomposition, one after implementation.

### Phase 1: Plan Creation (Human)

1. Developer writes `plan.md` in `.coding-agent-data/backlog/p-{id}/plan.md`
2. Pushes to a branch (e.g., `plans/my-feature`)
3. GitHub webhook notifies OpenClaw Gateway

### Phase 2: Decomposition (Automated, produces PR)

1. OpenClaw receives webhook, pulls branch, reads `plan.md`
2. `rlm-decompose` skill runs 3-level decomposition:
   - Plan -> Projects
   - Project -> Features
   - Feature -> Concerns (atomic tasks)
3. Writes task tree into the backlog directory:
   ```
   .coding-agent-data/backlog/p-{id}/
   +-- plan.md                              (original, untouched)
   +-- tasks/
       +-- {project-slug}/
           +-- task.md
           +-- features/
               +-- {feature-slug}/
                   +-- task.md
                   +-- concerns/
                       +-- {concern-slug}/
                           +-- task.md
   ```
4. Opens PR: "Decomposition for: {plan title}"
5. Notifies via Web UI: "Decomp ready for review"

### Phase 3: Decomposition Review (Human Gate)

- Developer reviews the PR containing the full task tree
- Can edit task.md files to refine scope, reorder, or remove tasks
- Can request re-decomposition of specific branches
- **The decomp PR is the contract** - these are the exact instructions Claude Code will receive
- Approves and merges when satisfied

### Phase 4: Execution (Automated, produces PRs per task)

1. Merge to main triggers OpenClaw (webhook or cron detection)
2. Trigger: presence of task tree on main with unexecuted tasks
3. `rlm-execute` skill reads task tree, resolves dependencies
4. For each ready concern (leaf-level task):
   - Spawns Docker container with repo clone
   - ACP session -> Claude Code inside container
   - Claude Code works on a feature branch
   - Follows CLAUDE.md conventions (go-task commands, test patterns)
   - Runs unit tests, lint, type check inside container
   - Cannot run integration/E2E tests (no services in container — CI handles these)
5. `rlm-github` skill opens PR linked to parent plan
6. `rlm-monitor` skill watches CI:
   - On failure: reads error output, spawns new ACP session to fix, pushes updated commit
   - On success: notifies via Web UI, marks task complete

### Phase 5: Implementation Review (Human Gate)

- Developer reviews implementation PRs
- OpenClaw does NOT auto-merge - human only
- On merge, task marked complete, next tasks unblocked

---

## Orchestration Model

### How OpenClaw Skills Work

Skills are **not microservices or standalone programs**. They are prompt instructions (SKILL.md files) loaded into the agent's context that teach it how to behave. When OpenClaw receives a trigger, the Gateway agent has all skills in context and decides what to do — or triggers can be wired directly to specific agent behaviors via webhooks.

### Architecture: Orchestrator + Sub-Agent Workers

One **orchestrator agent** runs persistently with all skills loaded. It receives triggers and spawns **sub-agents** for parallel work. Each sub-agent is an isolated session that runs independently and announces results back when done.

```
Orchestrator Agent (main session, always running)
|   Skills loaded: rlm-decompose, rlm-execute, rlm-github,
|                  rlm-monitor, rlm-e2e-tester
|
|   Receives: webhooks, cron ticks, Web UI messages
|   Decides: which skill applies, what action to take
|   Spawns: sub-agents for parallel work
|
+-- Sub-agent: Decompose plan p-abc123
+-- Sub-agent: Execute task backend/features/auth/concerns/jwt-guard
+-- Sub-agent: Execute task backend/features/auth/concerns/middleware
+-- Sub-agent: Fix CI failure on PR #42
+-- Sub-agent: Run E2E tests against deployed app
```

### Concurrency: Lane-Aware Queue

OpenClaw uses a lane-aware FIFO queue with configurable concurrency caps per lane:

| Lane | Default Cap | Purpose |
|---|---|---|
| `main` | 4 | Orchestrator conversations (Web UI, webhook handling) |
| `subagent` | 8 | Background workers (Claude Code sessions, decompositions) |
| `cron` | Separate | Scheduled monitoring (doesn't block other lanes) |

Sub-agents run in the `subagent` lane. Up to 8 can execute simultaneously; overflow queues in FIFO order.

**Recommended configuration for the Mac Mini:**
```json
{
  "agents": {
    "defaults": {
      "maxConcurrent": 8,
      "subagents": {
        "maxSpawnDepth": 2,
        "maxChildrenPerAgent": 10,
        "maxConcurrent": 8,
        "runTimeoutSeconds": 1800
      }
    }
  }
}
```

- `maxSpawnDepth: 2` — orchestrator spawns sub-agents, sub-agents can spawn ACP sessions
- `maxChildrenPerAgent: 10` — up to 10 sub-agents queued per orchestrator session
- `maxConcurrent: 8` — up to 8 sub-agents running in parallel
- `runTimeoutSeconds: 1800` — 30 minute timeout per sub-agent (prevents stuck sessions)

### Scaling: Dozens of Plans

If 12 plans land at once, each with 5 concern-level tasks:

```
12 plans x 5 concerns = 60 tasks total

Concurrency cap: 8 sub-agents at a time
Queue depth: 52 tasks waiting
Processing: 8 tasks running in parallel, FIFO drain

Bottlenecks (in order of likelihood):
1. Anthropic API rate limits (8 concurrent Claude Code sessions)
2. Mac Mini resources (64GB RAM, ~8 containers @ ~2-4GB each)
3. Git conflicts (multiple tasks touching same files)
```

Git conflicts are managed by dependency ordering: concerns within a feature execute sequentially, features across different areas parallelize safely.

### Trigger Wiring

```
Triggers:
|
+-- GitHub webhooks -> POST /hooks/agent
|   +-- Push to plans/* branch
|       -> "New plan detected at {path}, run decomposition"
|   +-- PR merged to main with .coding-agent-data/backlog/ changes
|       -> "Approved decomp, scan for unexecuted tasks and start execution"
|   +-- PR merged (implementation)
|       -> "Task complete, check for dependent tasks to unblock"
|
+-- Cron jobs (configured in openclaw.json)
|   +-- Every 5 min: rlm-monitor checks CI status on open PRs
|   +-- Every 10 min: rlm-e2e-tester checks for merged work needing validation
|   +-- Every 15 min: catch-up scan for anything webhooks missed
|
+-- Web UI (manual, conversational — accessible via Tailscale)
    +-- "What's the status of plan p-abc123?"
    +-- "Re-decompose the auth feature in plan p-abc123"
    +-- "Pause all execution"
    +-- "How many tasks are queued right now?"
```

**Webhook configuration example:**
```json
{
  "hooks": {
    "enabled": true,
    "token": "SECRET",
    "path": "/hooks",
    "mappings": {
      "github": {
        "match": { "source": "github" },
        "agentId": "orchestrator",
        "deliver": false
      }
    }
  }
}
```

**Cron configuration example:**
```json
{
  "cron": [
    {
      "id": "monitor-ci",
      "schedule": "*/5 * * * *",
      "message": "Check CI status on all open implementation PRs and handle failures"
    },
    {
      "id": "e2e-check",
      "schedule": "*/10 * * * *",
      "message": "Check for merged implementation PRs that need E2E validation"
    },
    {
      "id": "catchup-scan",
      "schedule": "*/15 * * * *",
      "message": "Scan backlog for any approved plans with unexecuted tasks"
    }
  ]
}
```

---

## Skills

Five skills loaded into the orchestrator agent. Each is a SKILL.md file that teaches the agent a specific capability.

### rlm-decompose

**When the orchestrator uses it**: New plan.md detected (via webhook or catchup scan)

**What it does**:
- Reads plan.md from the pushed branch
- Runs 3-level hierarchical decomposition using prompt templates
- Produces structured task tree (project/feature/concern directories with task.md files)
- Commits task tree to the branch
- Opens PR for human review
- Notifies via Web UI

**Execution model**: The orchestrator can run this directly (decomposition is a reasoning task, not a coding task) or spawn a sub-agent for it if it needs to handle other requests concurrently.

**Why not Claude Code**: Decomposition is an orchestration concern. It reads a plan and produces structured markdown. OpenClaw's Gateway agent (Claude Sonnet) handles this directly.

### rlm-execute

**When the orchestrator uses it**: Approved decomp merged to main (via webhook or catchup scan)

**What it does**:
- Scans `.coding-agent-data/backlog/` for plans with unexecuted tasks
- Resolves task dependency order
- For each ready task, **spawns a sub-agent** that:
  - Evaluates task complexity from task.md content
  - Selects coding agent: Claude Code (complex) or OpenCode (straightforward)
  - Creates a Docker container with repo clone
  - Starts ACP session -> selected coding agent inside container
  - Passes task.md content as the prompt
  - Coding agent works on a feature branch with full CLAUDE.md context
  - Runs unit tests, lint, type check
  - Pushes branch and opens PR (via rlm-github instructions)
- Multiple sub-agents run in parallel (up to maxConcurrent)

**Dependency resolution**: Projects execute in order, features within a project can parallelize, concerns within a feature execute in order.

### rlm-github

**When the orchestrator uses it**: Called as part of rlm-execute and rlm-monitor workflows

**What it does**:
- Creates feature branches (naming convention: `plan/{plan-id}/{concern-slug}`)
- Opens PRs with structured descriptions linking back to plan
- Polls CI status on open PRs (via GitHub API / `gh` CLI)
- Reads GitHub Actions logs on failure
- Surfaces CI failures as structured data for retry decisions

**Note**: This is more of a "knowledge module" than a standalone skill — it teaches the agent how to interact with GitHub correctly rather than being triggered independently.

### rlm-monitor

**When the orchestrator uses it**: Cron tick every 5 minutes

**What it does**:
- Checks CI status on all open implementation PRs
- On CI failure:
  - Reads error output from GitHub Actions
  - **Spawns a sub-agent** that starts ACP -> Claude Code with error context
  - Claude Code pushes fix commit to the PR branch
- On CI success:
  - Notifies via Web UI
  - Updates task status (checks for dependent tasks to unblock)
- Tracks retry count per task (max retries before escalating to Web UI for human input)

### rlm-e2e-tester

**When the orchestrator uses it**: Cron tick every 10 minutes

**What it does**:
- Watches for merged implementation PRs
- **Spawns a sub-agent** that runs Playwright E2E tests inside the OpenClaw pod
- Playwright launches headless Chromium, navigates to the deployed app via K8s service DNS
- Tests run against the **actual deployed app** (frontend, backend, keycloak, database — all in the `app` namespace on the same cluster)
- On pass: marks feature validated, notifies via Web UI
- On failure: creates GitHub issue with Playwright screenshots, error messages, test names, and reproduction steps
- GitHub issues feed back into the pipeline as new work items

**How it reaches the app**: The OpenClaw pod is in the `openclaw` namespace, the app is in the `app` namespace, both on the same K8s cluster. K8s DNS resolves cross-namespace:
- `http://frontend.app.svc.cluster.local:8080` (or via Traefik ingress: `http://app.mac-mini`)
- `http://backend.app.svc.cluster.local:8080`
- `http://keycloak.app.svc.cluster.local:8080`

**What this catches that CI doesn't**:
- Deployment-specific issues (missing env vars, broken ingress, failed migrations)
- Service communication failures (backend can't reach keycloak, frontend can't reach backend)
- State that only exists in the deployed environment (persisted database data, Keycloak realm config)

**Two possible paths for bug tickets** (to be decided later):
1. **Same flow**: Bug issue gets decomposed and executed like any other plan
2. **Dedicated bugfix flow**: Streamlined path that skips decomposition, goes straight to a Claude Code fix session with the bug report as context

**Why separate from rlm-monitor**: rlm-monitor watches CI on open PRs (pre-merge). rlm-e2e-tester validates integrated behavior after merge against the running application. Different trigger, different scope, different failure response.

---

## Decomposition Engine

The decomposition logic moves from the coding-agent NestJS backend (DecompositionService, 1197 lines of TypeScript) into OpenClaw as a skill + prompt templates.

### What carries forward

- **Prompt templates** (`.agent-prompts/decomposition.md` etc.) - these are the core value, they encode decomposition quality
- **3-level hierarchy** (plan -> project -> feature -> concern) - proven structure
- **Directory convention** for task output (task.md files in nested directories)

### What gets discarded

- The NestJS DecompositionService TypeScript code (was mostly SDK glue)
- In-memory session management (OpenClaw handles this)
- WebSocket streaming for decomp progress (Web UI notifications replace this)
- The Angular frontend for decomposition UI (OpenClaw Web UI replaces this)

### How it works in OpenClaw

The `rlm-decompose` skill is thin orchestration. The heavy lifting is in the prompt templates that tell the LLM how to decompose. The skill:

1. Reads plan.md
2. Injects prompt template + plan content + repo context (CLAUDE.md files, project structure)
3. OpenClaw's Gateway agent (Claude Sonnet) performs the decomposition
4. Skill parses output and writes task tree to filesystem
5. Commits and opens PR

The prompt templates need to be ported from `.agent-prompts/` and adapted to OpenClaw's skill format (SKILL.md with frontmatter).

---

## Task Status Convention

Minimal, git-native status tracking. No database, no status.json files.

**A task is "approved and ready"** when its task.md exists on the main branch (post-merge of the decomp PR).

**A task is "in progress"** when a feature branch exists for it: `plan/{plan-id}/{concern-slug}`

**A task is "complete"** when its implementation PR is merged to main.

**A task is "failed/stuck"** when retry count exceeds threshold - escalates to Web UI.

OpenClaw's Gateway maintains ephemeral execution state in memory. The durable state is git itself: branches, PRs, and merged commits.

---

## Testing Strategy

Three test stages, each catching progressively harder-to-find issues.

### Stage 1: In-Pod (Claude Code runs during task execution)

- **Unit tests** (Jest/Vitest) — fast, no services needed
- **Lint and type checking** — catches syntax/type errors
- **Build** — verifies compilation succeeds

### Stage 2: CI (GitHub Actions runs on each PR)

- **Integration tests** — need real database, backend, keycloak
- **E2E tests** — need the full app running in a browser
- **Build verification** — Docker image builds succeed

### Stage 3: Post-Merge E2E (rlm-e2e-tester, Playwright inside OpenClaw pod)

- **E2E validation against deployed app** — Playwright + headless Chromium in the OpenClaw pod
- App services reachable via K8s DNS (same cluster, different namespace)
- Tests the **actual deployment**, not a CI-specific build
- Catches: broken ingress, missing env vars, failed migrations, service communication issues
- **Smoke tests** — verifies deployed services are healthy
- **Regression checks** — ensures new code doesn't break existing flows

### The Feedback Loop

```
Claude Code (in pod)             CI (GitHub Actions)         E2E Tester (in pod, post-merge)
    |                                |                           |
    +-- unit tests pass              |                           |
    +-- pushes branch, opens PR      |                           |
    |                                +-- integration tests       |
    |                                +-- E2E tests               |
    |                                +-- reports pass/fail       |
    |                                |                           |
    +-- [on CI fail] gets error log  |                           |
    +-- fixes, pushes again          |                           |
    |                                +-- re-runs, passes         |
    |                                |                           |
    |                                |   PR merged by human      |
    |                                |                           |
    |                                |                           +-- Playwright E2E against
    |                                |                           |   deployed app (K8s DNS)
    |                                |                           +-- [on fail] creates bug issue
    |                                |                           |   with screenshots + logs
    |                                |                           +-- bug goes back through pipeline
```

This mirrors a real dev team: developer runs unit tests, CI catches integration issues, QA validates the deployed product. Except all three stages are automated.

---

## Model Routing: Dual Coding Agent Strategy

Two coding agents, routed by task complexity. OpenClaw's ACP supports both as first-class harnesses — switching is a config change.

### ACP Agent Selection

```bash
# Set default coding agent
openclaw config set acp.defaultAgent opencode    # self-hosted (default for volume)
openclaw config set acp.defaultAgent claude-code  # Anthropic API (for complex tasks)
```

The orchestrator skill instructions define which agent to use per task type. The orchestrator evaluates task complexity from the task.md content and spawns the appropriate ACP harness.

### Routing Table

| Task | Coding Agent | Model | Why |
|---|---|---|---|
| Orchestration, decomposition | OpenClaw native | Claude Sonnet (Anthropic API) | Reasoning task, not coding |
| Complex implementation (new features, architecture) | Claude Code | Claude Opus / Sonnet | Best quality for hard problems |
| Straightforward implementation (CRUD, boilerplate, patterns) | OpenCode | Self-hosted (Devstral, Qwen3-Coder, etc.) | Free, no rate limits |
| Bug fixes with clear error context | OpenCode | Self-hosted | Error + fix is usually straightforward |
| CI failure fixes (clear error log provided) | OpenCode | Self-hosted | Mechanical fix with full context |
| Ambient/conversational (Web UI) | OpenClaw native | Claude Sonnet (Anthropic API) | Conversational quality |

### Why This Matters

- **No rate limits on volume work**: Self-hosted models can run 8+ concurrent sessions without API throttling
- **Cost optimization**: Frontier API calls reserved for tasks that actually need them
- **Speed**: Local inference can be faster than API round-trips
- **Resilience**: If Anthropic API is down, OpenCode + self-hosted keeps working
- **Gradual migration**: Start with Claude Code for everything, shift work to OpenCode as you validate self-hosted model quality

### OpenCode Configuration

OpenCode connects to any OpenAI-compatible API endpoint:

```json
// opencode.json (in workspace or global)
{
  "provider": {
    "name": "custom",
    "endpoint": "https://your-company-llm.internal/v1",
    "model": "devstral-small-2"
  }
}
```

Or via environment variable:
```bash
export LOCAL_ENDPOINT="https://your-company-llm.internal/v1"
```

---

## Human Permissions

| Action | Permitted |
|---|---|
| Read any file in repo | Yes |
| Write/commit to feature branches | Yes |
| Open PRs | Yes |
| Push fix commits to open PRs | Yes |
| Merge PRs | No - human only |
| Deploy beyond dev environment | No - human only |
| Modify K8s NetworkPolicy / egress rules | No - human only |

---

## Security

### Layer 1: K8s Namespace Isolation

OpenClaw runs in its own namespace (`openclaw`), isolated from the `app` namespace:
- Separate service account with minimal RBAC
- Pod-level process and filesystem isolation
- Workspace PVC scoped to the openclaw namespace

### Layer 2: K8s NetworkPolicy (Future Hardening)

Can be added to restrict pod egress to specific CIDRs/domains:
- `api.anthropic.com` (Claude API)
- `api.github.com` + `github.com` (repo operations)
- `registry.npmjs.org` (npm packages)
- Cluster-internal DNS (K8s services)
- Company self-hosted LLM endpoint (for OpenCode, future)

Not needed for initial deployment but easy to add as a Helm template.

### Layer 3: Tailscale ACLs

- Mac Mini accessible only to tailnet devices
- GitHub Actions runners join tailnet ephemerally (tag:ci)
- Ingress (openclaw.mac-mini) only resolvable via Tailscale split DNS
- GitHub webhooks routed through Tailscale, not public internet

### Layer 4: Claude Code Permission Mode

- `--permission-mode plan` for read-only by default
- Explicit bypass only for write operations during task execution
- Tool-level restrictions via CLAUDE.md configuration

### Layer 5: Secrets Management

- Secrets never baked into Docker image
- Flow: GitHub Actions secret -> `.env` -> Helmfile -> K8s Secret -> pod env var
- Git credentials generated at runtime by entrypoint.sh from `GITHUB_TOKEN`
- API keys exist only in K8s Secrets and pod memory

---

## CLAUDE.md Requirements

These context files need to exist for Claude Code workers to operate effectively:

- **Root CLAUDE.md**: Monorepo overview, go-task command reference, testing conventions, branch naming, PR template
- **Backend CLAUDE.md**: NestJS patterns, DI conventions, module structure, API design standards
- **Frontend CLAUDE.md**: React component patterns, MUI theming, state management, naming conventions
- **Infrastructure CLAUDE.md**: K3s/Helmfile patterns, Traefik config, Tailscale networking context

---

## Migration Path

### Phase 1: Build and Deploy

- Build entire OpenClaw project (Dockerfile, Helm chart, skills, config, CLAUDE.md files)
- Add to Docker Compose for local dev
- Add to Helmfile for K8s deployment
- Add build/push step to GitHub Actions deploy workflow
- Merge to mac-mini, verify pod starts
- Configure GitHub webhook
- Open Web UI at `https://openclaw.mac-mini`, verify chat works
- Test: send message via Web UI -> get response

### Phase 2: Test Skills

- Push a test plan.md to plans/test branch
- Verify decomposition runs and PR opens
- Merge decomp PR, verify execution picks up tasks
- Validate Claude Code ACP sessions work inside the pod
- Test CI failure auto-fix loop
- Iterate on skill prompt quality

### Phase 3: Retire coding-agent

- Remove coding-agent-backend and coding-agent-frontend from Helmfile
- Remove from GitHub Actions build steps
- Remove from Docker Compose
- Leave source code intact for reference

### Phase 4: Security Hardening

- Add K8s NetworkPolicy to openclaw namespace (restrict egress)
- Review Tailscale ACLs
- Audit secrets and permissions

### Phase 5: E2E Tester

- Implement rlm-e2e-tester skill
- Configure to watch for merged PRs
- Run E2E suite against deployed dev environment
- On failure: create GitHub issue
- Decide on bugfix flow (same pipeline vs. streamlined path)

### Phase 6: OpenCode + Self-Hosted LLM Integration

- Add OpenCode CLI to the Docker image
- Configure OpenCode to point at company self-hosted LLM endpoint
- Configure ACP to offer both Claude Code and OpenCode as harnesses
- Update rlm-execute skill with task complexity routing
- Test: straightforward task -> OpenCode -> self-hosted model -> PR
- Compare quality, gradually shift volume work to OpenCode

---

## What Gets Deprecated

| Component | Status |
|---|---|
| `scripts/` (all shell scripts) | Deprecated - replaced by OpenClaw skills |
| `projects/coding-agent/backend/` | Deprecated - replaced by OpenClaw Gateway + skills |
| `projects/coding-agent/frontend/` | Deprecated - replaced by OpenClaw built-in Web UI |
| `coding-agent` K8s namespace | Deprecated - leave intact, stop deploying |
| `.coding-agent-data/agents/` | Deprecated - agents defined as OpenClaw skills |
| `.coding-agent-data/sessions/` | Deprecated - OpenClaw manages sessions |
| `scripts/hooks/` (session-start.py, session-stop.py) | Deprecated - OpenClaw hooks replace these |

### What Carries Forward

| Component | Status |
|---|---|
| `.coding-agent-data/backlog/` | Keeps - task tree lives here |
| `.agent-prompts/` | Migrates - ported to OpenClaw skill format |
| `projects/application/` | Keeps - the application being built |
| `infrastructure/` (K3s, Helmfile, Terraform) | Keeps - application deployment |
| `docs/` | Keeps - updated for new workflow |
| CLAUDE.md files | Keeps/Creates - essential for Claude Code workers |

---

## Open Questions

### Resolved
- **Parallel execution**: OpenClaw sub-agents handle this natively. Lane-aware queue with configurable concurrency.
- **How skills are triggered**: Webhooks + cron + Web UI. Orchestrator agent has all skills in context.
- **API rate limits at scale**: Dual-agent strategy (Claude Code + OpenCode) once self-hosted LLM is integrated.
- **Container/sandbox model**: OpenClaw runs in K8s pod (same pattern as coding-agent-backend). No separate sandbox needed.
- **Deployment**: Merge to mac-mini branch, same pipeline as everything else. No new infrastructure patterns.
- **Secrets management**: Same flow as coding-agent-backend: ENV_FILE_MAC_MINI -> Helmfile -> K8s Secret.
- **Local development**: Docker Compose service, same as all other services.

### Still Open
1. **ACP inside K8s pod**: Does ACP spawn Claude Code sub-processes correctly inside a K8s container? The coding-agent-backend already runs Claude Code SDK in a pod, so likely yes, but ACP may work differently.
2. **Decomp prompt portability**: How much rework do the `.agent-prompts/` templates need to become OpenClaw SKILL.md format?
3. **Cost tracking**: How does token usage get tracked across OpenClaw Gateway + Claude Code ACP sessions? Need visibility into spend.
4. **Webhook delivery to K8s pod**: GitHub webhook -> Tailscale -> Traefik ingress -> OpenClaw pod. Need to verify the full path works. Cron catchup is the safety net.
5. **Task dependency encoding**: Current convention is implicit (directory order). Should dependencies be explicit in task.md frontmatter?
6. **Bugfix flow**: When rlm-e2e-tester finds a bug, full decomposition or streamlined fix path?
7. **Sub-agent failure handling**: When a sub-agent times out or errors, how does the orchestrator retry?
8. **Self-hosted model quality threshold**: At what task complexity does self-hosted output become unreliable vs. Claude?
9. **Orchestrator context window**: With 5 skills loaded, will the context fill up during large plan processing?
10. **Pod resource limits**: 4Gi memory limit sufficient for OpenClaw Gateway + concurrent Claude Code ACP sessions? May need tuning.
