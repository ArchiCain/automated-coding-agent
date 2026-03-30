# The Big Time Plan: Cloud-Hosted Coding Agent + Dokploy Worktree Environments

## Vision

Transform the local-only coding agent system into a cloud-hosted development platform where:

1. **The coding-agent-frontend** runs on Dokploy (alongside the main app stack)
2. **The coding-agent-backend** runs on a dedicated EC2 with Claude Code CLI installed and the repo cloned
3. **Each worktree** spins up its own Dokploy EC2 instance in AWS — a real, fully deployed environment
4. **GitHub Actions** handles deployment — the agent just commits to its branch and the environment auto-redeploys
5. **The frontend** manages remote Dokploy instances the same way it manages local Docker today

This replaces the current local Docker compose per-worktree model with real cloud environments, while preserving the same UX patterns.

---

## Current Architecture (What We Have Today)

### Worktree + Docker Compose System

The coding-agent-backend's `EnvironmentService` manages the full lifecycle:

```
User clicks "Set Up Environment" for a plan
    │
    ▼
EnvironmentService.setup(planId):
    1. Calculate port offset index from planId (0-99, hex-based)
    2. Find available index (scan environment.json files for conflicts)
    3. Calculate ports: base + (index * 10)
       - backend: 8085 + offset
       - frontend: 3000 + offset
       - database: 5437 + offset
       - keycloak: 8081 + offset
    4. Create git worktree at .worktrees/{planId}
       - Branch: plan/{slugified-plan-name}
       - Reuses existing branch if it exists
    5. Copy root .env to worktree, replace ports + COMPOSE_PROJECT_NAME
       - composeProjectName: "projects-{planId}"
    6. Run `task start-local` in worktree with CLEAN_ENV
       - CLEAN_ENV = { PATH, HOME, USER } only — prevents parent env leaking
    7. Save state to .backlog/{planId}/environment.json
    8. Frontend polls /status every 3 seconds until ready
```

### What Runs Per Worktree

Each worktree gets a fully isolated Docker compose stack:

| Service | Port Pattern | Example (index=1) |
|---------|-------------|-------------------|
| Frontend | 3000 + (index*10) | 3010 |
| Backend | 8085 + (index*10) | 8095 |
| Database | 5437 + (index*10) | 5447 |
| Keycloak | 8081 + (index*10) | 8091 |

Compose project name: `projects-{planId}` ensures container/volume/network isolation.

### Frontend Controls

The frontend reuses the same components for both the base repo (Command Center) and worktree environments (Dev Environment page):

- `DockerControlsBar` — start/stop/restart all services (accepts `taskPrefix` input)
- `DockerServicesGrid` + `DockerServiceCard` — per-service controls with status, health, logs
- `EnvironmentInfoBar` — shows branch, worktree path, git status
- `TaskBar` + `TaskDock` — run any Taskfile task, stream output via WebSocket

Task naming pattern: `env:{planId}:{service}:{action}` for worktree-scoped tasks.

### Per-Service Operations Available Today

```
POST /api/environment/{planId}/services/{service}/stop
POST /api/environment/{planId}/services/{service}/start
POST /api/environment/{planId}/services/{service}/restart
POST /api/environment/{planId}/services/{service}/rebuild
GET  /api/environment/{planId}/services/{service}/logs?tail=200
GET  /api/environment/{planId}/services/{service}/health
```

Plus WebSocket log streaming via `/environment` namespace.

### Teardown

```
EnvironmentService.teardown(planId):
    1. task purge-local (stops + removes Docker services, volumes, networks)
    2. rm -rf worktree directory
    3. git worktree prune
    4. git branch -D plan/{name}
    5. Remove environment.json
```

---

## New Architecture (The Big Time Plan)

### The Shift

```
CURRENT:  worktree → local Docker compose → localhost:{port+offset}
NEW:      worktree → Terraform spins up Dokploy EC2 → GitHub Actions deploys branch
                                                     → https://{planId}.rtsdev.co
```

### System Topology

```
┌───────────────────────────────────────────────┐
│ Dokploy EC2 - Main (t3.large, ~$60/mo)        │
│   ├── Main app stack (prod): backend, frontend,│
│   │   keycloak, database                       │
│   ├── coding-agent-frontend (Angular)          │
│   └── Traefik (reverse proxy, SSL)             │
│                                                │
│   agent.rtsdev.co → coding-agent-frontend      │
│   app.rtsdev.co   → main frontend              │
│   api.rtsdev.co   → main backend               │
│   auth.rtsdev.co  → keycloak                   │
└────────────────────────────────────────────────┘
          ▲
          │ HTTP + WebSocket
          │
┌────────────────────────────────────────────────┐
│ Agent EC2 (t3.large default, resizable, ~$60/mo)│
│   ├── coding-agent-backend (NestJS, systemd)   │
│   ├── Claude Code CLI (authenticated)          │
│   ├── Chromium (headless, for MCP Playwright)  │
│   ├── Repo clone + worktrees                   │
│   ├── Git push → triggers GitHub Actions       │
│   └── Terraform CLI (for spinning up/down      │
│       Dokploy worktree instances)              │
│                                                │
│   agent-api.rtsdev.co → coding-agent-backend   │
│                                                │
│   Resize to t3.xlarge/2xlarge for sprint mode  │
└────────────────────────────────────────────────┘
          │
          │ git push to branch
          │ terraform apply/destroy
          ▼
┌────────────────────────────────────────────────┐
│ Worktree Dokploy EC2s (t3.medium, ~$30/mo each)│
│   Spun up on demand, one per active worktree   │
│                                                │
│   ┌── Worktree A (plan/user-auth)              │
│   │   ├── Full app stack via compose.prod.yml  │
│   │   ├── GitHub Actions deploys on commit     │
│   │   └── p-abc123.rtsdev.co                   │
│   │                                            │
│   ├── Worktree B (plan/dark-mode)              │
│   │   ├── Full app stack via compose.prod.yml  │
│   │   ├── GitHub Actions deploys on commit     │
│   │   └── p-def456.rtsdev.co                   │
│   │                                            │
│   └── (more as needed)                         │
└────────────────────────────────────────────────┘
```

### What Changes, What Stays the Same

| Aspect | Current (Local) | New (Cloud) | Change Needed |
|--------|----------------|-------------|---------------|
| **Worktree creation** | `git worktree add .worktrees/{planId}` | Same — happens on Agent EC2 | None |
| **Branch strategy** | `plan/{slugified-name}` | Same | None |
| **Plan/state storage** | `.backlog/{planId}/environment.json` in git | Same — git is file storage | None |
| **.rtslabs/plans/** | Checked into git in worktree | Same | None |
| **Environment spin-up** | `task start-local` (Docker compose) | `terraform apply` (Dokploy EC2) | New Terraform module |
| **Deployment** | Docker compose builds locally | GitHub Actions on commit to branch | New GH Actions workflow |
| **Port allocation** | Dynamic port offsets on localhost | Each env gets its own domain | Simpler (no port math) |
| **Service controls** | Docker compose commands locally | Dokploy REST API remotely | New DokployApiService |
| **Log streaming** | `docker compose logs -f` via WebSocket | Dokploy API or SSH-based log tailing | New log transport |
| **Health checks** | curl localhost:{port}/health | curl https://{planId}.rtsdev.co/health | URL change only |
| **Teardown** | `task purge-local` + rm worktree | `terraform destroy` + rm worktree + delete branch | New teardown flow |
| **Frontend UI** | DockerServiceCard, DockerControlsBar | Same components, different backend calls | Minimal UI changes |
| **Agent testing** | Chrome extension, Playwright, local logs | Playwright against remote URL, remote logs | See "Agent Testing" section |

---

## Detailed Design

### 1. Coding-Agent-Frontend on Dokploy

Trivially feasible. The Angular app builds to static files. Dokploy serves it behind Traefik with SSL.

**Configuration needed:**
- `CODING_AGENT_BACKEND_URL` → `https://agent-api.rtsdev.co`
- Dokploy project tracking the `main` branch
- Auto-deploys when coding-agent-frontend code changes on main

**Domain:** `agent.rtsdev.co` (or similar)

### 2. Coding-Agent-Backend on Dedicated EC2

The NestJS backend runs natively (not in Docker) because it needs:
- Direct filesystem access to the repo and worktrees
- Ability to spawn Claude Code CLI subprocesses
- Git operations (worktree create, branch, commit, push)
- Terraform CLI for spinning up/down Dokploy instances

**EC2 Setup (via user-data or AMI):**
- Node.js 20+
- Git
- Claude Code CLI (`npm install -g @anthropic-ai/claude-code`)
- Chromium (headless, for MCP Playwright browser testing)
- Terraform / OpenTofu
- AWS CLI (for Terraform provider)
- GitHub CLI (`gh`) for PR operations
- The repo cloned at `/home/agent/repo`

**Credentials (via AWS Secrets Manager → injected at boot):**
- `ANTHROPIC_API_KEY` — Claude Code authentication
- GitHub deploy key or token — for push access
- AWS credentials — for Terraform to manage worktree EC2s

**Process Management:**
- systemd service for the NestJS backend
- Auto-restart on crash
- Logs to journald (queryable via `journalctl`)

**Domain:** `agent-api.rtsdev.co`

**Sizing:** t3.large (8GB, ~$60/mo) default for single-session work. Resizable to t3.xlarge/t3.2xlarge/t3.4xlarge on demand for parallel sprint mode. No software concurrency limits — the constraint is purely instance RAM.

**Memory budget per session:**
- Claude Code process: ~500MB-1GB
- MCP Playwright browser (if used): ~200-500MB
- Total per session: ~700MB-1.5GB
- OS + NestJS backend overhead: ~1-2GB
- Usable for sessions at t3.large (8GB): 1 session with browser, or 2 without

### 3. Worktree Dokploy Instances (The Core Innovation)

Each worktree gets its own Dokploy EC2. This is the same pattern already planned in the Dokploy migration for dev/test/qa/bugfix environments — just automated and tied to the coding agent workflow.

#### Terraform Module

```
infrastructure/worktree-env/
├── main.tf              # EC2 + Dokploy (from pre-baked AMI)
├── variables.tf         # planId, branch, subdomain
├── outputs.tf           # elastic_ip, dokploy_url, app_url
└── dokploy-configure.sh # Post-boot: connect repo, set branch, configure domain
```

**Resources per worktree environment:**
- EC2 instance (t3.medium, from pre-baked Dokploy AMI — ~3 min boot)
- Elastic IP (stable address for DNS)
- Security group (80, 443, 3000 for Dokploy UI)
- Route53 A record: `{planId}.rtsdev.co` → Elastic IP

**Terraform workspace per worktree:**
```bash
terraform workspace new {planId}
terraform apply \
  -var="plan_id={planId}" \
  -var="branch=plan/{name}" \
  -var="subdomain={planId}"
```

#### Dokploy Configuration (Post-Boot)

The `dokploy-configure.sh` script (or Dokploy API calls from the agent backend):
1. Configure Dokploy auth with the Terraform-generated API token
2. Connect the GitHub repository in Dokploy
3. Set the tracked branch to `plan/{name}`
4. Set compose file to `compose.prod.yml`
5. Configure environment variables (DB creds, API keys, etc.)
6. Set domain: `{planId}.rtsdev.co`
7. Traefik auto-provisions SSL via Let's Encrypt

**Authentication:** Each instance gets a unique API token generated by Terraform (`random_password` resource), passed via user-data, output as a Terraform sensitive output, and stored in `environment.json` by the agent backend. See Decision #3.

#### Cost Model

| Resource | Cost | Notes |
|----------|------|-------|
| EC2 t3.medium | ~$1/day | Per worktree, only while active |
| Elastic IP (attached) | Free | Only charged when NOT attached |
| EBS 30GB gp3 | ~$0.08/day | Minimal storage |
| **Per worktree/day** | **~$1.10** | |
| **3-day feature** | **~$3.30** | |

Auto-cleanup: TTL on worktree environments. After N days idle, auto-destroy.

### 4. GitHub Actions for Deployment

On each commit to a `plan/*` branch, GitHub Actions:
1. Detects which Dokploy instance tracks that branch
2. Triggers a webhook to that Dokploy instance
3. Dokploy pulls the latest code, rebuilds, redeploys

**The agent just has to commit.** The deployment is automatic.

```yaml
# .github/workflows/worktree-deploy.yml
name: Deploy Worktree Environment

on:
  push:
    branches:
      - 'plan/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Determine Dokploy instance
        # Look up which Dokploy instance tracks this branch
        # Could be a simple mapping file in the repo, or an API call to agent-backend

      - name: Trigger Dokploy webhook
        run: |
          curl -X POST "https://{dokploy-instance}:3000/api/webhook" \
            -H "Authorization: Bearer ${{ secrets.DOKPLOY_TOKEN }}" \
            -d '{"branch": "${{ github.ref_name }}"}'
```

**Alternative:** Dokploy's built-in GitHub webhook integration. When the repo is connected in Dokploy and the branch is configured, Dokploy automatically redeploys on push. No GitHub Actions needed for the deploy itself — GitHub Actions could be reserved for running tests.

### 5. Frontend Managing Remote Dokploy Instances

The frontend already has `DockerControlsBar`, `DockerServiceCard`, `DockerServicesGrid`, `EnvironmentInfoBar` — all accepting configurable inputs (`envId`, `taskPrefix`, ports, etc.).

**What changes:**

Instead of calling the backend's environment endpoints (which run `docker compose` locally), the backend calls the **Dokploy REST API** on the remote instance.

**New Backend Service: `DokployApiService`**

```typescript
@Injectable()
export class DokployApiService {
  // Maps to existing frontend UI actions:

  async getServiceStatuses(planId: string): Promise<ServiceStatus[]> {
    // GET https://{planId}.rtsdev.co:3000/api/application/{appId}
    // Returns container states from Dokploy
  }

  async startService(planId: string, service: string): Promise<void> {
    // POST https://{planId}.rtsdev.co:3000/api/application/{appId}/start
  }

  async stopService(planId: string, service: string): Promise<void> {
    // POST https://{planId}.rtsdev.co:3000/api/application/{appId}/stop
  }

  async redeploy(planId: string): Promise<void> {
    // POST https://{planId}.rtsdev.co:3000/api/application/{appId}/deploy
  }

  async getServiceLogs(planId: string, service: string, tail: number): Promise<string> {
    // GET https://{planId}.rtsdev.co:3000/api/application/{appId}/logs
  }

  async triggerDeploy(planId: string): Promise<void> {
    // Trigger redeployment (after agent commits)
  }
}
```

**The frontend UI barely changes.** The `DockerServiceCard` still shows status, health, start/stop/restart buttons, and logs. The backend just routes those actions to Dokploy API instead of local Docker compose.

**New additions to the frontend:**
- **Environment URL** — clickable link to `https://{planId}.rtsdev.co` (the live app)
- **Dokploy UI link** — link to `https://{planId}.rtsdev.co:3000` (Dokploy admin)
- **Provision/Destroy buttons** — trigger Terraform apply/destroy via the agent backend

### 6. EnvironmentService Refactor

The existing `EnvironmentService` becomes an orchestrator that delegates to either local Docker or remote Dokploy based on configuration:

**Updated EnvironmentState:**
```typescript
interface EnvironmentState {
  // Existing fields (unchanged)
  index: number;
  worktreePath: string;
  branch: string;
  composeProjectName: string;
  steps: { worktree: StepState; docker: StepState };
  status: 'setting_up' | 'ready' | 'stopped' | 'error' | 'torn_down';

  // New fields for cloud environments
  mode: 'local' | 'cloud';
  cloud?: {
    instanceId: string;          // EC2 instance ID
    elasticIp: string;           // Elastic IP address
    dokployUrl: string;          // https://{planId}.rtsdev.co:3000
    appUrl: string;              // https://{planId}.rtsdev.co
    terraformWorkspace: string;  // Terraform workspace name
    provisionedAt: string;
    lastDeployedAt: string;
  };

  // Port fields become optional (not needed for cloud — each env gets its own domain)
  ports?: { backend: number; frontend: number; database: number; keycloak: number };
}
```

**Updated Setup Flow (Cloud Mode):**
```
EnvironmentService.setup(planId, mode='cloud'):
    1. Create git worktree (same as today)
    2. Instead of Docker compose:
       a. terraform workspace new {planId}
       b. terraform apply (creates Dokploy EC2 from pre-baked AMI)
       c. Configure Dokploy via API (connect repo, set branch, env vars, domain)
       d. Wait for Dokploy to finish initial deployment
    3. Save state with cloud metadata to environment.json
    4. Frontend polls /status — sees Terraform progress, then Dokploy deploy progress
```

**Updated Teardown (Cloud Mode):**
```
EnvironmentService.teardown(planId):
    1. terraform destroy (terminates EC2, releases Elastic IP, removes DNS)
    2. terraform workspace delete {planId}
    3. rm -rf worktree directory
    4. git worktree prune
    5. Remove environment.json
    // Branch is NOT deleted — manual cleanup via frontend (see Decision #4)
```

---

## The Big Open Question: How Do Agents Test Against Remote Environments?

### Current Agent Testing (Local)

Today, when Claude Code implements a feature locally:
- It can run the app via Docker compose and see it at `localhost:{port}`
- It can use the Chrome extension or Playwright to interact with the UI
- It reads Docker logs via `docker compose logs`
- It runs unit tests and integration tests locally
- It has direct filesystem access to check build output, error logs, etc.

### Remote Environment Testing — Approaches

#### Approach A: Log-Based Testing (Simplest, Most Immediate)

The agent interacts with the remote environment the same way you interact with ECS today — through log tasks.

**How it works:**
1. Agent commits code → GitHub Actions deploys to Dokploy instance
2. Agent waits for deployment to complete (poll Dokploy API for deploy status)
3. Agent reads deployment logs to check for build/startup errors
4. Agent runs service-specific log tasks: `task {planId}:backend:logs`
5. Agent can curl the health endpoints: `curl https://{planId}.rtsdev.co/api/health`
6. Agent can make API calls to test endpoints directly

**Task-based log access (mirrors existing ECS log tasks):**
```yaml
# Taskfile.yml — generated per worktree environment
{planId}:backend:logs:
  cmds:
    - ssh dokploy@{elastic_ip} "docker compose -f compose.prod.yml logs backend --tail 200"
    # OR via Dokploy API:
    - curl -s "https://{planId}.rtsdev.co:3000/api/application/{appId}/logs?tail=200"

{planId}:frontend:logs:
  cmds:
    - curl -s "https://{planId}.rtsdev.co:3000/api/application/{appId}/logs?tail=200"

{planId}:deploy:status:
  cmds:
    - curl -s "https://{planId}.rtsdev.co:3000/api/application/{appId}" | jq '.status'
```

**Pros:** Simple. Mirrors what you already do with ECS. Agent uses existing skills (reading logs, making HTTP requests).
**Cons:** No visual/UI testing. Agent can't "see" the app.

#### Approach B: Playwright Against Remote URL

The agent writes and runs Playwright tests targeting the remote environment URL.

**How it works:**
1. Agent implements the feature + writes Playwright tests
2. Agent commits → Dokploy deploys
3. Agent (or GitHub Actions) runs Playwright against `https://{planId}.rtsdev.co`
4. Test results (pass/fail + screenshots) feed back to the agent

**Where Playwright runs:**
- **Option 1: On the Agent EC2** — Playwright is installed alongside Claude Code. Agent spawns `npx playwright test --base-url=https://{planId}.rtsdev.co`. This works but requires a headed browser or Xvfb.
- **Option 2: In GitHub Actions** — The deploy workflow triggers a test job after deployment. Results posted as PR comments or artifacts. Agent reads the results.
- **Option 3: Dedicated test runner** — A lightweight container on the Dokploy instance that runs E2E tests post-deploy.

**Pros:** Real UI testing. Catches visual regressions. Agent can write tests as part of the feature.
**Cons:** Slower feedback loop. Browser installation on Agent EC2. Flaky test management.

#### Approach C: Combined (Recommended)

Use both approaches based on the stage of work:

| Stage | Testing Approach |
|-------|-----------------|
| During implementation | Agent reads logs + makes API calls (fast feedback) |
| Feature complete | Playwright tests run against remote URL (comprehensive) |
| Pre-merge | Full E2E suite in GitHub Actions (gating) |

**The agent's testing workflow:**
```
1. Implement code changes
2. Commit + push → auto-deploy
3. Wait for deploy (poll Dokploy status API)
4. Quick validation:
   - curl health endpoints
   - Read deploy logs for errors
   - Make a few API calls to test new endpoints
5. If issues found → fix, commit, repeat from 3
6. When confident → run Playwright tests
7. If tests pass → mark task complete, open PR
8. GitHub Actions runs full E2E suite on the PR
```

#### Approach D: Agent Uses the MCP Playwright Tool

Claude Code already has access to browser tools via MCP (Playwright plugin). The agent could:
1. Navigate to `https://{planId}.rtsdev.co`
2. Take snapshots, interact with the UI
3. Verify the feature works visually

This is essentially what the Chrome extension does locally, but against a remote URL. No special setup needed — the MCP Playwright tools work with any URL.

**Pros:** Uses existing tooling. Agent gets visual feedback. No test suite to maintain.
**Cons:** Slower than API calls. Relies on agent's ability to interpret visual output.

---

## Provisioning Timeline Estimates

| Step | Duration | Notes |
|------|----------|-------|
| Create worktree | ~2 seconds | Same as today |
| Terraform apply (pre-baked AMI) | ~3-4 minutes | EC2 boot + Dokploy ready |
| Dokploy initial deploy | ~3-5 minutes | Clone, build, start containers |
| **Total: new environment** | **~7-10 minutes** | First-time setup |
| Subsequent deploys (commit) | ~2-4 minutes | Rebuild + restart only |
| Terraform destroy | ~1-2 minutes | Terminate + cleanup |

Compare to local Docker compose: ~2-5 minutes for full stack build + start.

The cloud path is slower for initial setup but subsequent deploys (just commit) are comparable. And you get a real, shareable URL instead of localhost.

---

## Implementation Phases

### Phase 0: Prerequisites (from existing Dokploy migration plan)
- [ ] Flatten Docker compose (compose.common.yml + compose.dev.yml + compose.prod.yml)
- [ ] Create minimal Terraform for main Dokploy instance
- [ ] Deploy main app stack to Dokploy
- [ ] Verify git-push-to-deploy works

### Phase 1: Agent EC2 Infrastructure
- [ ] Create Terraform module for Agent EC2
- [ ] User-data script: install Node.js, Claude Code CLI, Git, Terraform, GH CLI
- [ ] Clone repo, configure git credentials
- [ ] Set up ANTHROPIC_API_KEY from Secrets Manager
- [ ] systemd service for coding-agent-backend
- [ ] Domain: agent-api.rtsdev.co

### Phase 2: Worktree Dokploy Module
- [ ] Create Terraform module for worktree Dokploy EC2s
- [ ] Pre-bake Dokploy AMI (Ubuntu + Dokploy pre-installed)
- [ ] Terraform workspace strategy (one per planId)
- [ ] Post-boot Dokploy configuration (repo, branch, env vars, domain)
- [ ] Route53 wildcard or per-environment A records
- [ ] Auto-cleanup / TTL mechanism

### Phase 3: Backend Refactor — EnvironmentService
- [ ] Add `mode: 'local' | 'cloud'` to EnvironmentState
- [ ] Cloud setup flow: terraform apply → configure Dokploy → poll for ready
- [ ] Cloud teardown flow: terraform destroy → cleanup
- [ ] DokployApiService for remote service management
- [ ] Adapt log streaming for remote environments (Dokploy API or SSH)
- [ ] Health checks against remote URLs

### Phase 4: GitHub Actions Integration
- [ ] Workflow: on push to `plan/**` branches → trigger Dokploy webhook
- [ ] Or: rely on Dokploy's built-in GitHub webhook (simpler)
- [ ] Optional: post-deploy test job (Playwright against remote URL)

### Phase 5: Frontend Adaptation
- [ ] Show environment URL (clickable link to live app)
- [ ] Show Dokploy UI link
- [ ] Provision/Destroy buttons (trigger Terraform via agent backend)
- [ ] Adapt service controls to use Dokploy API responses
- [ ] Remote log viewing (Dokploy API-based)
- [ ] Deploy status indicator (deploying/deployed/failed)

### Phase 6: Agent Testing Integration
- [ ] Log task templates for each worktree environment
- [ ] Health check polling against remote URLs
- [ ] Playwright test runner integration (Agent EC2 or GitHub Actions)
- [ ] MCP Playwright against remote URL for visual verification
- [ ] Feedback loop: deploy status → agent notification → iterate or continue

---

## Key Advantages Over Current Setup

1. **Shareable URLs** — Send `https://p-abc123.rtsdev.co` to a client or teammate. They see the live feature. No "run this Docker command" instructions.

2. **Real environment testing** — Not just "it works on my machine." Real DNS, real SSL, real network. If it works in the worktree Dokploy instance, it works in prod (same Dokploy, same compose file).

3. **Agent just commits** — The simplest possible deployment interface for an AI agent. `git commit && git push`. GitHub Actions + Dokploy handle the rest.

4. **Parallel features at scale** — Local Docker is limited by your laptop's RAM/CPU. Cloud instances are unlimited (limited only by budget). Run 5 features in parallel without your laptop fan screaming.

5. **Same teardown model** — `terraform destroy` is as clean as `task purge-local`. No orphaned containers, no port conflicts, no disk space issues.

6. **Dokploy consistency** — The worktree environment uses the exact same Dokploy + compose.prod.yml as production. No "works in dev Docker but breaks in prod" gaps.

---

## Decisions (All Resolved)

### 1. Agent EC2: Always-On, with On-Demand Resize

**Decision:** Start always-on for simplicity. Add start/stop capability later once usage patterns are clear.

The Agent EC2 is **resizable on demand** rather than fixed-size. The default instance type handles day-to-day single-session work. When a deadline hits and you need to sprint with multiple parallel sessions, resize the instance up (stop → change type → start, ~2-5 min), run your sessions, then resize back down.

**Default:** t3.large (8GB, ~$60/mo) — handles 1 concurrent Claude Code session comfortably.

**Sprint mode:** Resize to t3.xlarge (16GB, ~$120/mo) or t3.2xlarge (32GB, ~$240/mo) on demand for 2-4+ concurrent sessions. Pay for speed only when you need it.

**Future optimization:** Add a start/stop mechanism (frontend button or API) so the instance only runs during active development hours. This would drop costs to ~$20-40/mo depending on usage. Not needed for v1.

### 2. Concurrent Claude Code Sessions: Start at 1, Scale Unlimited

**Decision:** Start with 1 concurrent session (t3.large). Scale up by resizing the instance whenever more parallelism is needed. No artificial concurrency limits in the software — the constraint is purely RAM on the instance.

| Need | Instance | RAM | Sessions | Cost |
|------|----------|-----|----------|------|
| Day-to-day | t3.large | 8GB | 1 | ~$60/mo |
| Moderate sprint | t3.xlarge | 16GB | 2-3 | ~$120/mo |
| Heavy sprint | t3.2xlarge | 32GB | 4-6 | ~$240/mo |
| Max throughput | t3.4xlarge | 64GB | 10+ | ~$480/mo |

Each Claude Code session uses ~500MB-1GB RAM. MCP Playwright browser instances add ~200-500MB each on top of that. Budget ~1.5GB per session with browser testing, ~1GB without.

The backend should track active sessions and report memory pressure so the frontend can suggest or automate instance resize when approaching limits.

### 3. Dokploy API Authentication: Per-Instance Token via Terraform

**Decision:** Each Dokploy instance gets its own unique API token, generated by Terraform at provisioning time and stored in `environment.json`.

**How it works:**
1. Terraform generates a random API token (e.g., `random_password` resource)
2. Token is passed to the Dokploy instance via user-data (used to configure Dokploy's auth on first boot)
3. Token is output by Terraform as a sensitive output
4. Agent backend reads the token from `terraform output -json` after apply
5. Token is stored in `environment.json` alongside other cloud metadata

**Why per-instance (not shared):**
- If one instance is compromised, others are unaffected
- Tokens can be rotated per-instance
- Terraform manages the lifecycle — no manual token management

**The automation is fully transparent:** the agent backend never needs to manually create or look up tokens. Terraform creates, outputs, and the backend reads and stores.

### 4. Branch Cleanup: Never Auto-Delete

**Decision:** Branches are never automatically deleted. Teardown destroys the Dokploy EC2 and cleans up the local worktree directory, but the git branch persists.

**Cleanup is manual** via the coding-agent-frontend. A branch management UI will allow:
- Viewing all `plan/*` branches
- Deleting branches individually
- Seeing which branches have associated environments (active or torn down)
- Seeing which branches have open/merged PRs

**Rationale:** Branches are cheap (just a pointer in git). Deleting them risks losing work or PR history. Manual cleanup is infrequent and low-effort.

**Updated teardown flow (cloud mode):**
```
EnvironmentService.teardown(planId):
    1. terraform destroy (terminates EC2, releases Elastic IP, removes DNS)
    2. terraform workspace delete {planId}
    3. rm -rf worktree directory
    4. git worktree prune
    5. Remove environment.json
    // Branch is NOT deleted — stays in git for PR history
```

### 5. Observability: Lightweight for Worktree Instances

**Decision:** Worktree Dokploy instances do NOT get the full PLG observability stack. They use Dokploy's built-in container monitoring only.

**What worktree instances get:**
- Dokploy UI dashboard (container status, resource usage)
- Docker log access via Dokploy API
- Health check endpoints on the app services
- SSH access for ad-hoc debugging if needed

**What they don't get:**
- No Prometheus, Loki, Grafana, Tempo, Alloy, exporters
- No alerting (these are ephemeral development environments)

**Rationale:** Worktree instances are ephemeral and short-lived. Adding ~1.5-3GB of observability stack would require upsizing from t3.medium to t3.large per instance, doubling the cost for minimal benefit. The full observability stack is reserved for the main production Dokploy instance.

### 6. Database & Seeding: App-Managed

**Decision:** Database migrations and seeding are handled entirely by the application's start scripts. This is not a concern for the infrastructure layer.

The compose.prod.yml start scripts auto-run migrations on container start (same as the illume-main pattern). If tests need specific data, they generate it themselves as part of their test setup.

No golden snapshots, no infrastructure-level seeding. The apps own their data lifecycle.

### 7. Agent Testing Against Remote Environments

**Decision:** Multi-layered approach. The testing strategy is still being refined, but the infrastructure supports all approaches.

**What the infrastructure provides:**
1. **Log access** — Dokploy API exposes container logs. Agent backend proxies these to the coding-agent-frontend and to Claude Code sessions via task-based log commands.
2. **Health endpoints** — Agent can curl `https://{planId}.rtsdev.co/api/health` directly.
3. **API testing** — Agent can make HTTP requests to the remote environment's API endpoints.
4. **Browser testing (MCP Playwright)** — Claude Code sessions have access to MCP Playwright tools (`browser_navigate`, `browser_snapshot`, `browser_click`, etc.) which work with any URL, including remote Dokploy environments. This gives the agent "eyes" on the UI.
5. **Formal Playwright tests** — Can run headless Playwright on the Agent EC2 against the remote URL, or offload to GitHub Actions.
6. **GitHub Actions test jobs** — Post-deploy test step that runs the full E2E suite. Results posted to the PR for the agent (or human) to review.

**Browser testing limitations:**
- Headless Chromium works fine on EC2 (no display server needed)
- Each browser instance uses ~200-500MB RAM — factor this into instance sizing
- Multiple concurrent sessions with browsers require more RAM (budget ~1.5GB/session)
- GitHub Actions is the escape valve: offload heavy browser testing to GH runners (browsers pre-installed, no local resource cost)
- MCP Playwright runs a single browser instance per Claude Code session — manageable for 1-2 sessions, gets tight at higher concurrency

---

## Cost Summary

### Day-to-Day (Single Session)

| Component | Monthly Cost | Notes |
|-----------|-------------|-------|
| Main Dokploy EC2 | ~$60 | t3.large, always-on, prod + agent frontend |
| Agent EC2 | ~$60 | t3.large, always-on, 1 session |
| Worktree EC2s | ~$1/day each | Only while active |
| Claude Code API | Variable | $1-10+ per feature depending on complexity |
| **Steady state (no active features)** | **~$120/mo** | |
| **Active development (1 feature)** | **~$150/mo** | +~$1/day for worktree instance |

### Sprint Mode (Multiple Sessions)

| Component | Monthly Cost | Notes |
|-----------|-------------|-------|
| Main Dokploy EC2 | ~$60 | t3.large, always-on |
| Agent EC2 (resized) | ~$120-240 | t3.xlarge-2xlarge, temporary resize |
| Worktree EC2s | ~$3-5/day | 3-5 parallel features |
| Claude Code API | Variable | Higher volume during sprint |
| **Sprint period** | **~$200-320/mo** | Only while sprinting |

### Compared To Current

| Setup | Monthly Cost | Capability |
|-------|-------------|------------|
| Current ECS | ~$95-120/mo | Main app deployed, no agent cloud |
| Big Time Plan (day-to-day) | ~$120/mo | Main app + cloud agent + on-demand worktree envs |
| Big Time Plan (sprint) | ~$200-320/mo | Parallel features, pay-for-speed |

The day-to-day cost is comparable to the current ECS setup while adding the entire coding agent cloud platform. Sprint mode costs more but is temporary and chosen deliberately when deadlines require it.

---

## What This Ultimately Enables

```
You open the coding-agent-frontend in your browser.
You describe a feature: "Add dark mode to the app."

The decomposition engine breaks it into tasks.
You approve the plan.

The agent:
  1. Creates a worktree + branch
  2. Spins up a Dokploy EC2 in ~7 minutes
  3. Implements each task using Claude Code
  4. Commits after each task → auto-deploys to the live env
  5. Checks logs, runs health checks, verifies the API
  6. Runs Playwright tests against https://p-abc123.rtsdev.co
  7. Opens a PR with a link to the live preview

You click the preview link.
You see the app with dark mode running in AWS.
You test it. It works.
You approve the PR. It merges. Dokploy deploys to prod.
The worktree EC2 auto-terminates.

Total human effort: describe the feature, click a link, approve the PR.
```

---

## Notes & References

- Dokploy migration plan: `.backlog/p-65a392/plan.md`
- Existing environment service: `projects/coding-agent-backend/app/src/features/claude-code-agent/services/environment.service.ts`
- Existing environment controller: `projects/coding-agent-backend/app/src/features/claude-code-agent/controllers/environment.controller.ts`
- Frontend Docker controls: `projects/coding-agent-frontend/app/src/app/features/local-env/`
- Frontend dev environment page: `projects/coding-agent-frontend/app/src/app/features/backlog/pages/dev-environment/`
- Docker services config: `projects/coding-agent-frontend/app/src/app/features/local-env/config/docker-services.config.ts`
