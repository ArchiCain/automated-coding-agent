# THE Dev Team

> THE dev team everyone is going to want to come to.

## Vision

THE Dev Team is an autonomous software development system where AI coding agents operate like real development teams — each with their own isolated development environment, full CI/CD pipeline, and the ability to validate their work end-to-end before submitting it for human review.

When a task comes in, THE Dev Team doesn't just write code. It branches, builds, deploys, tests, validates visually, checks accessibility, monitors performance, and only then submits a pull request. By the time a human reviewer sees the PR, the code has already been proven to work in a real environment.

---

## Core Architecture

### The Big Picture

```
┌──────────────────────────────────────────────────────────────────┐
│  THE Dev Team Orchestrator (NestJS)                              │
│                                                                  │
│  Receives tasks → assigns to agents → monitors progress          │
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                 │
│  │  Agent 1   │  │  Agent 2   │  │  Agent 3   │  (up to N)      │
│  │            │  │            │  │            │                  │
│  │ worktree:  │  │ worktree:  │  │ worktree:  │                 │
│  │ feature-x  │  │ bugfix-y   │  │ feature-z  │                 │
│  │            │  │            │  │            │                 │
│  │ namespace: │  │ namespace: │  │ namespace: │                 │
│  │ env-feat-x │  │ env-fix-y  │  │ env-feat-z │                 │
│  └────────────┘  └────────────┘  └────────────┘                 │
│                                                                  │
│  /workspace/repo          ← git clone (PVC, survives restarts)   │
│  /workspace/worktrees/*   ← sibling dir, one per active task     │
└──────────────────────────────────────────────────────────────────┘

Each agent:
  1. Creates a git worktree + branch
  2. Writes code via Claude Code SDK
  3. Builds Docker images from the worktree
  4. Deploys a full app stack to its own K8s namespace
  5. Validates: tests, logs, API, frontend, design, performance
  6. Iterates until all validation gates pass
  7. Commits, pushes, opens PR
  8. Tears down its namespace
  9. Waits for the next task
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Orchestrator | NestJS 11 (TypeScript) | Task management, agent lifecycle, API |
| AI Engine (Anthropic) | Claude Code SDK (`@anthropic-ai/claude-code`) | Full agentic coding via Claude |
| AI Engine (Open Source) | OpenCode (`opencode`) | Agentic coding via any model (Gemini, Ollama, OpenAI, etc.) |
| Provider Abstraction | `CodingAgentProvider` interface | Swappable engine per task role — same contract, different backends |
| Container Runtime | Docker (via Nix, no Docker Desktop) | Image builds |
| Orchestration | Kubernetes (minikube locally, K3s in prod) | Namespace-per-environment isolation |
| Package Manager | Helm + Helmfile | Parameterized environment deployment |
| Image Registry | In-cluster registry (localhost:30500) | No external registry dependency |
| Ingress | Traefik | Dynamic per-namespace routing |
| Dev Environment | Nix Flakes | Reproducible toolchain |
| Task Runner | go-task (Taskfile) | Build, deploy, and ops automation |
| Frontend Testing | Playwright + Chromium | E2E, visual, accessibility validation |
| Infrastructure | Terraform (AWS EC2 + K3s for prod) | Production cluster provisioning |
| DNS | Tailscale + CoreDNS | Network-wide access to environments |

---

## Infrastructure

### Local Development: Minikube + Nix

Docker Desktop is eliminated. The entire stack runs on:

- **Nix** provides: Docker engine, kubectl, helm, helmfile, node, go-task, and all CLI tools
- **Minikube** provides: local K8s cluster with ingress, DNS, and storage
- **In-cluster registry** at `localhost:30500` for image storage
- **Traefik** for ingress with wildcard routing

No Docker Compose. Everything runs in K8s from day one. Local and production are the same topology — only the node count and resource limits differ.

### Production: K3s on EC2

Already provisioned via Terraform:

- EC2 `t3.large` (or larger) with 50GB persistent data volume
- K3s single-node cluster with Traefik
- Tailscale for network access (`*.mac-mini` DNS)
- Same Helmfile, same charts, same workflow

### Namespace-per-Environment Model

Every active task gets its own K8s namespace containing a full application stack:

```
Namespace: env-feature-user-profile
├── deployment/backend         (NestJS API)
├── deployment/frontend        (React SPA)
├── deployment/keycloak        (Auth provider)
├── statefulset/database       (PostgreSQL)
├── service/* (ClusterIP for each)
├── ingress (Traefik)
│   ├── api.feature-user-profile.localhost
│   ├── app.feature-user-profile.localhost
│   └── auth.feature-user-profile.localhost
└── configmap + secret (env-specific config)
```

**Lifecycle:**
1. Agent runs `helm install` with parameterized values (namespace, image tags, ingress hosts)
2. Full stack comes up in ~60-90 seconds
3. Agent validates against the live environment
4. On completion: `kubectl delete namespace env-feature-user-profile` — clean teardown

**Database strategy per namespace:**
- Option A: Fresh PostgreSQL per namespace with seed data (full isolation, slower)
- Option B: Shared read-only staging database + per-namespace write schema (faster, less isolated)
- Start with Option A for simplicity; migrate to Option B when startup time matters

### In-Cluster Docker Builds

The agent pod needs to build Docker images from worktree source code. Options:

| Method | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| Kaniko | No Docker daemon, runs as normal pod | Slower, no layer cache by default | Best for production |
| BuildKit (rootless) | Fast, good caching | Requires some privileges | Good middle ground |
| Docker-in-Docker | Simplest, closest to local dev | Requires privileged pod | Good for starting |

Start with Docker-in-Docker for simplicity. The agent pod runs with Docker socket access and builds images the same way the existing `task build:*` commands do, pushing to the in-cluster registry.

---

## Deployment Safety and Git Security Model

This is the most critical section of the entire architecture. THE Dev Team must never be able to directly deploy to any protected environment. The agent is a developer, not an operator. It writes code, proves it works, and submits a PR. A human approves. GitHub Actions deploys. No exceptions.

### Protected Environments

There are two classes of environments in this system:

**Protected environments** (agent can NEVER deploy to):
- `main` / `production` — the live application
- `staging` — pre-production validation
- The orchestrator's own namespace (`the-dev-team`) — the agent must not be able to modify or redeploy itself

**Agent-owned environments** (agent has full control):
- `env-{task-id}` namespaces — ephemeral, disposable, fully isolated sandboxes
- These exist solely for the agent to test its work
- They are torn down after PR submission
- Nothing outside the agent depends on them

The agent can do whatever it wants in its sandboxes. It can break them, rebuild them, delete them. But it can never touch a protected environment. The boundary is enforced at every layer.

### GitHub Branch Protection

Branch protection rules are the primary safety mechanism. They are configured on GitHub, not controlled by the agent:

**`main` branch protections:**
- Require pull request before merging (no direct pushes)
- Require at least 1 approving review from a human
- Require status checks to pass (CI/CD pipeline)
- Require branches to be up to date before merging
- Require signed commits (optional but recommended)
- Do not allow bypassing the above settings (not even admins, if desired)
- Restrict who can push: only GitHub Actions bot for merge commits

**`staging` branch protections (if used):**
- Same rules as `main`
- May allow auto-merge after CI passes (depending on workflow)

The agent's Git user does not have permission to push to `main` or `staging`. Period. It can only push to its own feature branches.

### Agent Git Identity

A dedicated GitHub user (machine account) is created for THE Dev Team:

**Account: `the-dev-team-bot` (or similar)**

**Repository permissions:**
- `Contents: write` — can push branches and create commits
- `Pull requests: write` — can create and update PRs
- `Issues: read` — can read issues for task intake
- `Actions: none` — cannot trigger or modify workflows
- `Settings: none` — cannot modify repo settings or branch protections
- `Administration: none` — cannot manage collaborators or access

**Branch restrictions:**
- Can push to: `the-dev-team/*` branches only (enforced via branch protection rulesets)
- Cannot push to: `main`, `staging`, `release/*`, or any other protected pattern
- Branch naming convention: `the-dev-team/{task-type}/{short-description}`

**Commit signing:**
- The bot account uses a GPG key or SSH signing key for commit verification
- All commits from THE Dev Team are verifiably attributed to the bot account
- Reviewers can see at a glance that a PR came from the agent

```
GitHub Repository Settings:
├── Branch protection: main
│   ├── Require PR: yes
│   ├── Required reviewers: 1 (human)
│   ├── Required status checks: [ci/build, ci/test, ci/lint]
│   ├── Require up-to-date: yes
│   └── Restrict pushes: GitHub Actions only
├── Branch protection: staging
│   ├── (same as main)
│   └── Restrict pushes: GitHub Actions only
├── Branch ruleset: the-dev-team/**
│   ├── Allow push: the-dev-team-bot
│   ├── Allow create: the-dev-team-bot
│   └── Allow delete: the-dev-team-bot (cleanup after merge)
└── Branch ruleset: ** (everything else)
    └── Allow push: human developers only
```

### Deployment Pipeline

Deployments to protected environments happen exclusively through GitHub Actions, triggered only by merge events:

```
Agent pushes branch → Agent opens PR → Human reviews → Human approves
                                                            │
                                                            ▼
                                                     Merge to main
                                                            │
                                                            ▼
                                              GitHub Actions triggered
                                              (on: push to main)
                                                            │
                                              ┌─────────────┴──────────────┐
                                              ▼                            ▼
                                        CI Pipeline                  CD Pipeline
                                        ├─ lint                     ├─ docker build
                                        ├─ typecheck                ├─ push to registry
                                        ├─ unit tests               ├─ helm upgrade
                                        └─ integration tests        └─ verify health
                                              │                            │
                                              ▼                            ▼
                                         Must pass                  Deploy to staging
                                                                          │
                                                                          ▼
                                                                   (manual gate or
                                                                    auto-promote)
                                                                          │
                                                                          ▼
                                                                  Deploy to production
```

**Key constraints:**
- GitHub Actions workflows are defined in `.github/workflows/` on the `main` branch
- The agent cannot modify workflow files (branch protection prevents pushing to `main`)
- Even if the agent created a workflow file on its feature branch, it wouldn't execute with elevated permissions (GitHub Actions security model — see below)
- Deployment credentials (K8s kubeconfig, registry auth) are stored as GitHub Actions secrets — the agent never has access to them
- The agent's `GITHUB_TOKEN` / PAT has no access to Actions secrets or environment deployments

### GitHub Actions Security Model (why the agent can't abuse workflows)

GitHub has a built-in security model for workflows that provides defense in depth:

**Workflows on feature branches are neutered:**
- Workflows only run with repository secrets when the workflow file exists on the default branch (`main`)
- If the agent creates or modifies a `.github/workflows/*.yml` on its feature branch, that workflow:
  - Will NOT have access to repository secrets
  - Will NOT have access to deployment environments
  - Will NOT trigger on `push` to `main` (because the file isn't on `main` yet)
  - CAN only run in the `pull_request` event context with read-only `GITHUB_TOKEN` permissions
- This is GitHub's security model, not something we configure — it's always enforced

**The remaining risk:** The agent could submit a PR that adds or modifies a workflow file. If a human merges that PR without noticing the workflow change, the malicious/broken workflow would go live on `main`. The protection is human review, but we make it impossible to miss:

**CODEOWNERS protection for workflows:**

```
# .github/CODEOWNERS

# Workflow and Actions files require explicit approval from repo owner(s)
# The agent's bot account is NOT a code owner — its approval doesn't count
/.github/workflows/    @your-github-username
/.github/actions/      @your-github-username

# Protect any GitHub config-as-code files
/.github/settings.yml  @your-github-username
/.github/CODEOWNERS    @your-github-username
```

With CODEOWNERS + branch protection requiring review from code owners:
- Any PR that touches `.github/workflows/` automatically requests review from you
- The PR **cannot be merged** until you (the code owner) explicitly approve
- GitHub UI prominently flags "this PR modifies CODEOWNERS-protected files"
- The bot account's approval is irrelevant — only the listed code owner's approval satisfies the requirement

**CODEOWNERS itself is protected** — adding `/.github/CODEOWNERS @your-github-username` to the file means the agent can't modify the CODEOWNERS file without your approval either. This prevents the agent from removing its own restrictions.

**Additional workflow protections to consider:**
- GitHub repository setting: "Require approval for all outside collaborators" for Actions
- GitHub repository setting: "Require approval for first-time contributors" for Actions
- Limit `GITHUB_TOKEN` default permissions to read-only at the repository level (workflows must explicitly request write permissions)
- Use GitHub Environments with required reviewers for deployment jobs (even if a workflow runs, deployment steps wait for human approval)

### Agent Namespace Isolation (K8s RBAC)

The agent pod's K8s service account is scoped to only allow operations on agent-owned namespaces:

```yaml
# Agent can create/delete/manage namespaces matching env-*
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: the-dev-team-agent
rules:
  # Can manage namespaces, but only create/delete (not modify system ones)
  - apiGroups: [""]
    resources: ["namespaces"]
    verbs: ["create", "delete", "get", "list"]
  # Full control within namespaces (deployments, services, pods, etc.)
  - apiGroups: ["", "apps", "networking.k8s.io"]
    resources: ["*"]
    verbs: ["*"]
```

Combined with a validating admission webhook or OPA/Gatekeeper policy:

```yaml
# Policy: agent service account can only operate on env-* namespaces
# Deny any operation on: default, kube-system, the-dev-team, app, monitoring, traefik, registry
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sBlockNamespaceAccess
metadata:
  name: agent-namespace-restriction
spec:
  match:
    kinds:
      - apiGroups: ["*"]
        kinds: ["*"]
  parameters:
    restrictedNamespaces:
      - "default"
      - "kube-system"
      - "kube-public"
      - "the-dev-team"
      - "app"
      - "staging"
      - "monitoring"
      - "traefik"
      - "registry"
      - "dns"
    restrictedServiceAccounts:
      - "the-dev-team:the-dev-team-agent"
```

The agent literally cannot kubectl apply/delete/modify resources in any protected namespace. The K8s API server rejects the request before it reaches any controller.

### Secret Isolation

The agent must never have access to production secrets:

**Secrets the agent HAS:**
- `ANTHROPIC_API_KEY` — for Claude Code SDK calls (when using Anthropic provider)
- LLM provider API keys as configured per role (e.g., `GEMINI_API_KEY`, `OPENAI_API_KEY`) — only for the models assigned to task roles
- No LLM API keys needed for Ollama (runs locally, no auth)
- `GITHUB_TOKEN` — scoped PAT for the bot account (push branches, create PRs, read issues)
- Registry credentials — push/pull to in-cluster registry only

**Secrets the agent NEVER has:**
- Production database credentials
- Production API keys (Stripe, SendGrid, etc.)
- Deployment credentials (kubeconfig for prod cluster)
- GitHub Actions secrets
- Admin tokens for any service in protected namespaces
- Keycloak admin credentials for prod/staging

Agent-owned namespaces use isolated credentials:
- Each `env-{task-id}` namespace gets its own database with throwaway credentials
- API keys for third-party services in agent environments are test/sandbox keys only
- No secret from an agent namespace can authenticate against a protected service

### Self-Modification Prevention

THE Dev Team orchestrator runs in the `the-dev-team` namespace. The agent cannot:

- Modify the orchestrator's deployment (K8s RBAC blocks it)
- Push to branches that would trigger a redeployment of the orchestrator (branch protections)
- Access the orchestrator's secrets or config (namespace isolation)
- Modify GitHub Actions workflows that deploy the orchestrator

The orchestrator is updated the same way as any other service: a human merges a PR to `main`, GitHub Actions deploys it. The agent can submit PRs that modify the orchestrator code, but those changes only take effect after human review and merge.

### Safety Checklist

Before THE Dev Team goes live, verify:

**GitHub Branch & Access Controls:**
- [ ] `main` branch protection: require PR, require review, require status checks
- [ ] `staging` branch protection: same as main
- [ ] Bot account created with minimal permissions (contents:write, pull_requests:write, issues:read)
- [ ] Bot account restricted to `the-dev-team/**` branch pattern
- [ ] Bot account cannot push to `main`, `staging`, or any protected branch
- [ ] Branch ruleset prevents agent from creating branches outside its pattern
- [ ] Commit signing enabled for bot account

**GitHub Actions & Workflow Protection:**
- [ ] GitHub Actions workflows deploy on merge to `main` only
- [ ] Deployment credentials stored as GitHub Actions secrets (not accessible to bot)
- [ ] CODEOWNERS file protects `.github/workflows/`, `.github/actions/`, and `.github/CODEOWNERS`
- [ ] Branch protection requires code owner approval (not just any reviewer)
- [ ] Default `GITHUB_TOKEN` permissions set to read-only at repository level
- [ ] GitHub Environments configured with required reviewers for deployment jobs

**Kubernetes Isolation:**
- [ ] K8s RBAC: agent service account scoped to `env-*` namespaces only
- [ ] K8s admission policy (OPA/Gatekeeper): agent blocked from protected namespaces
- [ ] Orchestrator namespace (`the-dev-team`) is in the protected namespace list
- [ ] Agent cannot modify its own deployment or config

**Secret Management:**
- [ ] No production secrets in agent environment
- [ ] Agent namespace databases use throwaway credentials
- [ ] Third-party API keys in agent environments are sandbox/test keys
- [ ] Agent PAT has no access to Actions secrets or environment deployments

**History & Audit Trail:**
- [ ] `the-dev-team/history` branch created and protected
- [ ] History branch: only GitHub Actions (or history sync token) can push
- [ ] History branch: agent bot account explicitly denied push access
- [ ] History branch: force push and delete denied for everyone
- [ ] History sync GitHub Action configured (scheduled + repository_dispatch)
- [ ] History sync token (if using Option B) scoped to history branch only
- [ ] PVC retention cleanup scheduled (task `history:cleanup`)

---

## Agent Architecture

### The Orchestrator

The orchestrator is the evolution of `projects/coding-agent/backend/`. It manages the full lifecycle:

```
┌──────────────────────────────────────────────────────────────┐
│  Orchestrator (NestJS)                                       │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Task Intake   │  │ Agent Pool   │  │ Environment Mgr   │  │
│  │              │  │              │  │                   │  │
│  │ - GitHub     │  │ - Spawn      │  │ - Helm install    │  │
│  │   issues     │  │ - Monitor    │  │ - Helm uninstall  │  │
│  │ - Manual     │  │ - Reassign   │  │ - Health check    │  │
│  │   queue      │  │ - Kill       │  │ - Image builds    │  │
│  │ - Backlog    │  │              │  │                   │  │
│  └──────────────┘  └──────────────┘  └───────────────────┘  │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Session Mgr  │  │ PR Manager   │  │ Scheduler         │  │
│  │              │  │              │  │                   │  │
│  │ - State      │  │ - Create     │  │ - Cron jobs       │  │
│  │ - History    │  │ - Update     │  │ - CI monitoring   │  │
│  │ - Resume     │  │ - Review     │  │ - Health sweeps   │  │
│  │              │  │   feedback   │  │                   │  │
│  └──────────────┘  └──────────────┘  └───────────────────┘  │
│                                                              │
│  WebSocket ──→ Status Dashboard (real-time agent progress)   │
└──────────────────────────────────────────────────────────────┘
```

**Key services:**

- **Task Intake**: Receives work from GitHub issues, manual queue, or the decomposed backlog. Prioritizes and assigns to available agents.
- **Agent Pool**: Manages concurrent agent instances (max N, configurable). Each agent is a Claude Code SDK `query()` session running in its own async context.
- **Environment Manager**: Creates and tears down K8s namespaces. Builds and pushes Docker images. Manages Helm releases per environment.
- **Session Manager**: Tracks agent state, conversation history, worktree locations, namespace assignments. Supports resume after crashes.
- **PR Manager**: Creates PRs with structured descriptions, test results, screenshots. Handles review feedback loops (reviewer comments trigger agent re-work).
- **Scheduler**: Cron-based jobs for CI monitoring, stale environment cleanup, health sweeps.

### The Agent Execution Loop

Each agent runs this loop for every task:

```
receive_task(task)
│
├─ 1. SETUP
│  ├─ git fetch origin
│  ├─ git worktree add /workspace/worktrees/{task-id} -b {branch-name}
│  │   (worktrees live OUTSIDE the repo clone as a sibling directory
│  │    to avoid Docker build context issues with shared .git)
│  └─ cd /workspace/worktrees/{task-id}
│
├─ 2. IMPLEMENT
│  ├─ Load soul + relevant skills as system prompt context
│  ├─ Claude Code SDK query() with task description
│  ├─ Agent writes code, tests, documentation
│  └─ (Claude Code handles the inner tool loop: Read, Write, Edit, Bash, etc.)
│
├─ 3. BUILD + DEPLOY (devops role — sandbox namespace ONLY)
│  ├─ Docker build from worktree source
│  ├─ Tag with branch name + short SHA
│  ├─ Push to in-cluster registry (localhost:30500)
│  ├─ Gate: build must succeed → if fail, fix and retry
│  ├─ helm install {task-id} --namespace env-{task-id} --create-namespace
│  ├─ K8s RBAC + admission policy enforce: only env-* namespaces allowed
│  ├─ Wait for all pods ready
│  ├─ Verify health endpoints respond
│  └─ Gate: deployment must be healthy → if fail, diagnose logs, fix, rebuild, redeploy
│
├─ 4. TEST (tester + designer roles — against the live deployed environment)
│  ├─ Gate: Unit tests
│  ├─ Gate: Integration tests (against live services in sandbox namespace)
│  ├─ Gate: Log audit (no errors in backend/frontend logs)
│  ├─ Gate: API validation (endpoints return expected data)
│  ├─ Gate: Database validation (state is correct)
│  ├─ Gate: E2E tests (Playwright against deployed env — designer role)
│  ├─ Gate: Accessibility audit (axe-core WCAG AA — designer role)
│  ├─ Gate: Design review (visual, see Design Validation section — designer role)
│  ├─ Gate: Performance check (response times, no regressions)
│  └─ Each failed gate → fix code → rebuild → redeploy → re-validate
│
├─ 5. REVIEW + FIX
│  ├─ Reviewer checks the full changeset, writes findings to state file
│  ├─ If findings exist → bugfixer reads, fixes, rebuilds, redeploys, verifies
│  └─ Max 3 bugfixer iterations before escalation
│
├─ 6. SUBMIT
│  ├─ git add + commit (conventional commit message)
│  ├─ git push origin {branch-name}
│  ├─ gh pr create with:
│  │   ├─ Structured description (what, why, how)
│  │   ├─ Test results summary
│  │   ├─ Screenshots at all breakpoints
│  │   ├─ Accessibility audit results
│  │   ├─ Performance metrics
│  │   └─ Link to live environment (if kept alive for review)
│  └─ Gate: PR must be created successfully
│
├─ 7. CLEANUP
│  ├─ helm uninstall {task-id} --namespace env-{task-id}
│  ├─ kubectl delete namespace env-{task-id}
│  ├─ git worktree remove /workspace/worktrees/{task-id}
│  └─ (or keep environment alive if configured for PR review)
│
└─ 8. WAIT
   └─ Report completion → pick up next task or idle
```

### Coding Agent Provider Abstraction

The AI engine is abstracted behind a provider interface using object-oriented principles. This allows THE Dev Team to use different coding agent backends for different task roles — Claude Code for heavy implementation, OpenCode with Gemini for review, Ollama for documentation, etc.

#### The Interface

```typescript
/**
 * Core contract that all coding agent providers must implement.
 * Whether it's Claude Code, OpenCode with Gemini, or OpenCode with Ollama,
 * the orchestrator sees the same shape.
 */
interface CodingAgentProvider {
  /** Unique identifier for this provider instance */
  readonly id: string;

  /** Human-readable name (e.g., "Claude Code", "OpenCode (Gemini)") */
  readonly name: string;

  /** Execute a coding task and stream results */
  execute(request: AgentExecutionRequest): AsyncIterable<AgentMessage>;

  /** Check if the provider is available and properly configured */
  healthCheck(): Promise<ProviderHealthStatus>;

  /** Get the capabilities this provider supports */
  capabilities(): ProviderCapabilities;
}

interface AgentExecutionRequest {
  /** The task prompt / instruction */
  prompt: string;

  /** Working directory for file operations */
  cwd: string;

  /** System prompt (soul + skills) */
  systemPrompt: string;

  /** Which tools the agent is allowed to use */
  allowedTools: string[];

  /** Optional: resume a previous session */
  sessionId?: string;

  /** Optional: abort signal for cancellation */
  signal?: AbortSignal;
}

interface AgentMessage {
  /** Message type for the orchestrator to handle */
  type: "text" | "tool_use" | "tool_result" | "error" | "status" | "complete";

  /** The content of the message */
  content: string;

  /** Raw provider-specific data (for logging/debugging) */
  raw?: unknown;
}

interface ProviderCapabilities {
  /** Can this provider execute shell commands? */
  shellExecution: boolean;

  /** Can this provider read/write/edit files? */
  fileOperations: boolean;

  /** Does this provider handle its own agentic tool loop? */
  agenticLoop: boolean;

  /** Can this provider resume previous sessions? */
  sessionResume: boolean;

  /** Maximum context window (tokens) */
  contextWindow: number;
}

interface ProviderHealthStatus {
  healthy: boolean;
  message?: string;
  latencyMs?: number;
}
```

#### Claude Code Provider (Anthropic)

When the provider is set to `"anthropic"`, we use the Claude Code SDK directly. It handles the full agentic loop — tool calls, file operations, shell execution, session management — all built in.

```typescript
import { query } from "@anthropic-ai/claude-code-sdk";

class ClaudeCodeProvider implements CodingAgentProvider {
  readonly id = "claude-code";
  readonly name = "Claude Code";

  private model: string;

  constructor(config: { model?: string }) {
    this.model = config.model ?? "claude-sonnet-4-6";
  }

  async *execute(request: AgentExecutionRequest): AsyncIterable<AgentMessage> {
    for await (const message of query({
      prompt: request.prompt,
      options: {
        cwd: request.cwd,
        systemPrompt: request.systemPrompt,
        allowedTools: request.allowedTools,
        model: this.model,
        resume: request.sessionId,
      },
    })) {
      yield this.mapMessage(message);
    }
  }

  capabilities(): ProviderCapabilities {
    return {
      shellExecution: true,
      fileOperations: true,
      agenticLoop: true,      // Claude Code handles the full loop
      sessionResume: true,
      contextWindow: 200_000,  // Claude Sonnet/Opus
    };
  }

  async healthCheck(): Promise<ProviderHealthStatus> {
    // Verify Claude Code CLI is available and API key is set
    // ...
  }

  private mapMessage(sdkMessage: any): AgentMessage {
    // Map Claude Code SDK message types to our unified AgentMessage format
    // ...
  }
}
```

#### OpenCode Provider (Any Model)

When the provider is set to any non-Anthropic model, we use OpenCode — an open-source coding agent that can be configured to use any LLM backend. OpenCode is the open-source equivalent of Claude Code: it provides the same agentic loop (prompt → tool calls → results → re-prompt) but backed by any model.

```typescript
import { OpenCodeSession } from "opencode";  // or however OpenCode exposes its API

class OpenCodeProvider implements CodingAgentProvider {
  readonly id: string;
  readonly name: string;

  private modelProvider: string;  // "gemini", "ollama", "openai", etc.
  private modelId: string;        // "gemini-2.5-pro", "llama3.3:70b", "gpt-4.1", etc.

  constructor(config: { provider: string; model: string }) {
    this.modelProvider = config.provider;
    this.modelId = config.model;
    this.id = `opencode-${config.provider}`;
    this.name = `OpenCode (${config.provider}/${config.model})`;
  }

  async *execute(request: AgentExecutionRequest): AsyncIterable<AgentMessage> {
    const session = new OpenCodeSession({
      provider: this.modelProvider,
      model: this.modelId,
      cwd: request.cwd,
      systemPrompt: request.systemPrompt,
      tools: request.allowedTools,
    });

    for await (const event of session.run(request.prompt)) {
      yield this.mapMessage(event);
    }
  }

  capabilities(): ProviderCapabilities {
    return {
      shellExecution: true,
      fileOperations: true,
      agenticLoop: true,      // OpenCode handles the full loop too
      sessionResume: false,    // Depends on OpenCode's capabilities
      contextWindow: this.getContextWindow(),
    };
  }

  async healthCheck(): Promise<ProviderHealthStatus> {
    // Verify OpenCode is available and the model endpoint is reachable
    // ...
  }

  private getContextWindow(): number {
    // Return context window based on model
    // ...
  }

  private mapMessage(event: any): AgentMessage {
    // Map OpenCode event types to our unified AgentMessage format
    // ...
  }
}
```

#### Provider Registry and Role-Based Assignment

The orchestrator doesn't hardcode which provider to use. Instead, providers are registered and assigned to **task roles**. This is where the real power comes in — different roles can use different models:

```typescript
interface ProviderConfig {
  /** Which provider to use: "anthropic" uses Claude Code, anything else uses OpenCode */
  engine: "anthropic" | "opencode";

  /** Provider name (for OpenCode): "gemini", "ollama", "openai", etc. */
  provider?: string;

  /** Model identifier */
  model: string;
}

interface TaskRoleConfig {
  /** Primary implementation work — writes code, creates features, fixes bugs */
  implementer: ProviderConfig;

  /** Reviews code for correctness, security, best practices */
  reviewer: ProviderConfig;

  /** Writes and updates documentation, README, comments */
  documentarian: ProviderConfig;

  /** Writes unit and integration tests (not E2E) */
  tester: ProviderConfig;

  /** Understands the full codebase, creates detailed implementation plans and task trees */
  architect: ProviderConfig;

  /** Monitors CI, diagnoses failures */
  monitor: ProviderConfig;

  /** Designs UI, implements frontend, writes Playwright E2E tests, enforces design system (needs vision) */
  designer: ProviderConfig;

  /** Fixes bugs found by reviewer/tester — reads logs, makes changes, rebuilds, redeploys, verifies */
  bugfixer: ProviderConfig;

  /** Builds images, deploys to sandbox namespaces, reads logs, manages environments */
  devops: ProviderConfig;
}
```

**Default configuration** — everything uses Claude Code out of the box. No OpenCode setup required to get started:

```yaml
# the-dev-team.config.yml

# Default: all roles use Claude Code (Anthropic).
# Only override specific roles when you have a reason to.
default:
  engine: anthropic
  model: claude-sonnet-4-6

roles: {}
  # All roles inherit from `default` unless explicitly overridden.
  # To customize a specific role, add it here:
  #
  # architect:
  #   engine: anthropic
  #   model: claude-opus-4-6    # Use Opus for complex architectural planning
  #
  # documentarian:
  #   engine: opencode
  #   provider: ollama
  #   model: llama3.3:70b       # Local model is fine for docs
```

**Customized example** — mix and match only where it makes sense:

```yaml
# the-dev-team.config.yml
default:
  engine: anthropic
  model: claude-sonnet-4-6

roles:
  # Override only the roles where a different model adds value.
  # Everything else falls through to the default (Claude Code).

  architect:
    engine: anthropic
    model: claude-opus-4-6      # Opus for deep codebase understanding and planning

  reviewer:
    engine: opencode
    provider: gemini
    model: gemini-2.5-pro       # Second pair of eyes from a different model family

  documentarian:
    engine: opencode
    provider: ollama
    model: llama3.3:70b         # Local model, no API cost for docs
```

The registry resolves providers at runtime:

```typescript
class ProviderRegistry {
  private providers = new Map<string, CodingAgentProvider>();

  register(config: ProviderConfig): CodingAgentProvider {
    const key = config.engine === "anthropic"
      ? `claude-code:${config.model}`
      : `opencode:${config.provider}:${config.model}`;

    if (!this.providers.has(key)) {
      const provider = config.engine === "anthropic"
        ? new ClaudeCodeProvider({ model: config.model })
        : new OpenCodeProvider({ provider: config.provider!, model: config.model });

      this.providers.set(key, provider);
    }

    return this.providers.get(key)!;
  }

  getForRole(role: keyof TaskRoleConfig, config: DevTeamConfig): CodingAgentProvider {
    // Role-specific config wins, otherwise fall back to the default
    const providerConfig = config.roles[role] ?? config.default;
    return this.register(providerConfig);
  }
}
```

#### How It Fits Into the Execution Loop

The orchestrator resolves the right provider for each phase of work:

```typescript
async function executeTask(task: Task, worktreePath: string, config: DevTeamConfig) {
  const registry = new ProviderRegistry();

  // Phase 0: Architecture — architect understands the full codebase and creates a plan
  const architect = registry.getForRole("architect", config);
  const plan = await runRole(architect, {
    prompt: `Analyze the codebase and create a detailed implementation plan for: ${task.description}`,
    cwd: worktreePath,
    skills: ["decompose"],
    allowedTools: ["Read", "Grep", "Glob"],  // Read-only — architect plans, doesn't write
  });

  // Phase 1: Implementation — implementer follows the architect's plan
  const implementer = registry.getForRole("implementer", config);
  await runRole(implementer, {
    prompt: `Implement the following plan:\n${plan}\n\nOriginal task: ${task.description}`,
    cwd: worktreePath,
    skills: ["execute", "database"],
    allowedTools: ["Read", "Write", "Edit", "Bash", "Grep", "Glob"],
  });

  // Phase 2: DevOps — build and deploy FIRST so live environment is available
  const devops = registry.getForRole("devops", config);
  await runRole(devops, {
    prompt: `Build images and deploy sandbox environment for task: ${task.id}`,
    cwd: worktreePath,
    skills: ["infrastructure"],
    allowedTools: ["Bash", "Read"],  // Bash runs task commands only
  });

  // Phase 3: Testing — tester writes and runs tests against the live environment
  const tester = registry.getForRole("tester", config);
  await runRole(tester, {
    prompt: `Write unit and integration tests for the changes made in: ${task.description}. Run integration tests against the live environment at env-${task.id}.`,
    cwd: worktreePath,
    skills: ["api-test"],
    allowedTools: ["Read", "Write", "Edit", "Bash", "Grep", "Glob"],
  });

  // Phase 4: Design — designer works against the live deployed environment
  //          Implements frontend refinements, writes Playwright E2E tests,
  //          validates visual design compliance (if task has frontend changes)
  if (task.touchesFrontend) {
    const designer = registry.getForRole("designer", config);
    await runRole(designer, {
      prompt: `Review and refine the frontend implementation for: ${task.description}.
               Write Playwright E2E tests against the live environment at env-${task.id}.
               Validate against the design system.`,
      cwd: worktreePath,
      skills: ["design-review", "e2e-test"],
      allowedTools: ["Read", "Write", "Edit", "Bash", "Grep", "Glob"],  // Bash for Playwright
    });
  }

  // Phase 5: Review — reviewer checks the full changeset
  const reviewer = registry.getForRole("reviewer", config);
  const reviewResult = await runRole(reviewer, {
    prompt: `Review all changes for: ${task.description}. Check for bugs, security issues, and adherence to project conventions. If issues are found, write findings to the task state file.`,
    cwd: worktreePath,
    skills: ["execute"],
    allowedTools: ["Read", "Write", "Grep", "Glob"],  // Write for state file findings
  });

  // Phase 5b: If reviewer found issues, bugfixer resolves them
  if (await hasFindings(task.id)) {
    const bugfixer = registry.getForRole("bugfixer", config);
    await runRole(bugfixer, {
      prompt: `Read the review findings for task ${task.id} and fix all issues. Rebuild, redeploy, and verify the fixes against the live environment.`,
      cwd: worktreePath,
      skills: ["execute", "infrastructure"],
      allowedTools: ["Read", "Write", "Edit", "Bash", "Grep", "Glob"],
    });
  }

  // Phase 6: Documentation — documentarian updates docs
  const documentarian = registry.getForRole("documentarian", config);
  await runRole(documentarian, {
    prompt: `Update documentation for the changes made in: ${task.description}`,
    cwd: worktreePath,
    skills: ["execute"],
    allowedTools: ["Read", "Write", "Edit", "Grep", "Glob"],
  });
}
```

#### Why This Architecture

The provider abstraction gives THE Dev Team several advantages:

1. **Cost optimization**: Use expensive models (Claude Opus) for planning, cheaper models (Ollama local) for documentation. Match model capability to task complexity.

2. **Vendor independence**: If Anthropic has an outage, switch the implementer to OpenCode + Gemini and keep working. No code changes — just config.

3. **Best-of-breed per role**: Gemini might be better at code review, Claude might be better at implementation, a local model might be perfectly fine for doc updates. Use each model where it excels.

4. **Open source compatibility**: The OpenCode provider means THE Dev Team works with any model that OpenCode supports — including fully local/private models via Ollama for air-gapped or compliance-sensitive environments.

5. **Future-proof**: When a new model or coding agent emerges, implement `CodingAgentProvider` and it plugs right in. The orchestrator, validation gates, deployment pipeline — none of it changes.

The orchestrator only manages the outer loop (implement → build → deploy → validate → iterate). Both Claude Code and OpenCode handle the inner agentic loop (prompt → tool calls → results → re-prompt) independently. The provider interface is the clean boundary between them.

### Soul and Skills

**Soul** (`skills/soul.md`): The agent's core behavioral rules. Always loaded as part of the system prompt.

Contents include:
- Code style and conventions for this specific project
- Architecture rules (feature-based organization, etc.)
- Git workflow rules (branch naming, commit messages, PR format)
- Safety rules: never push to protected branches, never modify workflows, never access production credentials, never deploy outside `env-*` namespaces
- Self-modification prohibition: never attempt to change orchestrator code, config, or deployment in a way that bypasses human review
- Self-validation expectations (don't submit until all gates pass)

**Skills** (`skills/*/SKILL.md`): Domain-specific knowledge and procedures loaded contextually based on the task type.

Ported and evolved from the OpenClaw skill definitions:

| Skill | Purpose | Used By Role |
|-------|---------|--------------|
| `decompose` | Analyze codebase, create detailed implementation plans and task trees | architect |
| `execute` | Implementation workflow, git procedures, code conventions | implementer, reviewer, documentarian |
| `github` | PR creation, issue management, review handling | monitor, orchestrator |
| `monitor` | CI pipeline monitoring and failure diagnosis | monitor |
| `design-review` | Design system rules, visual validation, responsive checks, UI state coverage | designer |
| `e2e-test` | Playwright E2E test writing and execution against deployed environments | designer |
| `api-test` | Unit test and integration test patterns, API contract testing | tester |
| `database` | Schema changes, migrations, data validation | implementer |
| `performance` | Load testing, metrics comparison, profiling | devops |
| `infrastructure` | Taskfile commands, Helm, K8s, Docker operations — never raw commands | devops |

---

## Taskfile as the Command Interface

Taskfile (`go-task`) is the **single source of truth** for every operation in the development environment. No agent, human, or CI pipeline should run raw `kubectl`, `helm`, `docker`, or other infrastructure commands directly. Everything goes through tasks.

This is critical for several reasons:

1. **Consistency**: The agent executes the same commands a human developer would. If `task deploy:apply` works for the human, it works for the agent. No drift.
2. **Discoverability**: `task --list` shows every available operation. The agent doesn't need to know kubectl flags or Helm value overrides — it knows task names.
3. **Safety**: Tasks encode the correct flags, namespaces, environment variables, and ordering. The agent can't accidentally `helm install` to the wrong namespace if the task handles namespace resolution.
4. **Auditability**: Every operation the agent performs is a named task. Logs show `task env:deploy -- feature-user-profile`, not a wall of kubectl commands.
5. **Maintainability**: When infrastructure changes (e.g., switching from Helm to Kustomize), only the Taskfile changes. The agent's behavior stays the same.

### Task Hierarchy

The existing Taskfile structure already follows a clean delegation pattern:

```
Root Taskfile.yml
├── backend:*              → Application backend tasks
├── frontend:*             → Application frontend tasks
├── database:*             → Database tasks
├── keycloak:*             → Auth provider tasks
├── e2e:*                  → E2E test tasks
├── infra:docker:*         → Docker Compose (deprecated, replaced by K8s)
├── infra:terraform:*      → Cloud infrastructure provisioning
├── infra:k8s:*            → Cluster-wide Helm deployments
├── build:*                → Docker image builds
├── deploy:*               → Cluster deployment operations
└── (NEW) env:*            → Agent sandbox environment lifecycle
```

### New Task Namespace: `env:*`

Agent sandbox environments get their own task namespace. These are the commands the **devops role** uses:

```yaml
# infrastructure/agent-envs/Taskfile.yml

tasks:
  # === Environment Lifecycle ===

  create:
    desc: Create a sandbox environment for a task
    # Usage: task env:create -- {task-id}
    # Creates namespace env-{task-id}, deploys full app stack
    cmds:
      - kubectl create namespace env-{{.CLI_ARGS}}
      - helm install {{.CLI_ARGS}}
          --namespace env-{{.CLI_ARGS}}
          --set image.tag={{.IMAGE_TAG}}
          --set ingress.host.prefix={{.CLI_ARGS}}
          -f values/sandbox.yaml
          ./charts/full-stack

  destroy:
    desc: Tear down a sandbox environment
    # Usage: task env:destroy -- {task-id}
    cmds:
      - helm uninstall {{.CLI_ARGS}} --namespace env-{{.CLI_ARGS}}
      - kubectl delete namespace env-{{.CLI_ARGS}} --wait=false

  status:
    desc: Show status of a sandbox environment
    # Usage: task env:status -- {task-id}
    cmds:
      - kubectl get pods -n env-{{.CLI_ARGS}} -o wide
      - kubectl get ingress -n env-{{.CLI_ARGS}}

  list:
    desc: List all active sandbox environments
    cmds:
      - kubectl get namespaces -l managed-by=the-dev-team

  health:
    desc: Check health of all services in a sandbox environment
    # Usage: task env:health -- {task-id}
    cmds:
      - |
        for svc in backend frontend keycloak; do
          echo "Checking $svc..."
          kubectl exec -n env-{{.CLI_ARGS}} deployment/$svc -- \
            curl -sf http://localhost:${svc_port}/health || echo "$svc: UNHEALTHY"
        done

  # === Logs ===

  logs:
    desc: Stream logs from a service in a sandbox environment
    # Usage: task env:logs -- {task-id} {service}
    cmds:
      - kubectl logs -n env-{{.TASK_ID}} deployment/{{.SERVICE}} -f --tail=200

  logs:all:
    desc: Stream logs from all services in a sandbox environment
    # Usage: task env:logs:all -- {task-id}
    cmds:
      - kubectl logs -n env-{{.CLI_ARGS}} -l managed-by=the-dev-team -f --tail=100

  logs:errors:
    desc: Show only error-level logs from a sandbox environment
    # Usage: task env:logs:errors -- {task-id}
    cmds:
      - kubectl logs -n env-{{.CLI_ARGS}} -l managed-by=the-dev-team --tail=500
          | jq -r 'select(.level == "error")'

  # === Builds ===

  build:
    desc: Build all images from a worktree
    # Usage: task env:build -- {task-id}
    # Builds from /workspace/worktrees/{task-id}
    cmds:
      - task: build:backend
        vars: { IMAGE_TAG: "{{.CLI_ARGS}}" }
      - task: build:frontend
        vars: { IMAGE_TAG: "{{.CLI_ARGS}}" }
      - task: build:keycloak
        vars: { IMAGE_TAG: "{{.CLI_ARGS}}" }

  # === Database ===

  db:shell:
    desc: Open a psql shell in a sandbox environment
    # Usage: task env:db:shell -- {task-id}
    cmds:
      - kubectl exec -it -n env-{{.CLI_ARGS}} statefulset/database
          -- psql -U postgres -d application

  db:query:
    desc: Run a query against a sandbox database
    # Usage: task env:db:query -- {task-id} "SELECT count(*) FROM users"
    cmds:
      - kubectl exec -n env-{{.TASK_ID}} statefulset/database
          -- psql -U postgres -d application -c "{{.QUERY}}"

  # === Debugging ===

  exec:
    desc: Exec into a pod in a sandbox environment
    # Usage: task env:exec -- {task-id} {service}
    cmds:
      - kubectl exec -it -n env-{{.TASK_ID}} deployment/{{.SERVICE}} -- /bin/sh

  port-forward:
    desc: Port-forward a service from a sandbox environment
    # Usage: task env:port-forward -- {task-id} {service} {port}
    cmds:
      - kubectl port-forward -n env-{{.TASK_ID}}
          deployment/{{.SERVICE}} {{.PORT}}:{{.PORT}}

  restart:
    desc: Restart a service in a sandbox environment
    # Usage: task env:restart -- {task-id} {service}
    cmds:
      - kubectl rollout restart -n env-{{.TASK_ID}} deployment/{{.SERVICE}}

  # === Cleanup ===

  cleanup:stale:
    desc: Tear down sandbox environments older than N hours
    # Usage: task env:cleanup:stale -- 24
    cmds:
      - |
        kubectl get namespaces -l managed-by=the-dev-team \
          --sort-by=.metadata.creationTimestamp -o json \
          | jq -r '.items[] | select(
              (now - (.metadata.creationTimestamp | fromdateiso8601)) > ({{.CLI_ARGS}} * 3600)
            ) | .metadata.name' \
          | xargs -I{} task env:destroy -- {}
```

### The Devops Role

The **devops** role is the agent persona responsible for all infrastructure operations within sandbox environments. It does not write application code — it builds, deploys, monitors, and manages the environments that the other roles work against.

**What the devops role does:**
- Builds Docker images from worktree code (`task env:build`)
- Creates sandbox namespaces with full app stacks (`task env:create`)
- Monitors pod health and readiness (`task env:health`, `task env:status`)
- Reads and interprets logs (`task env:logs`, `task env:logs:errors`)
- Restarts services when needed (`task env:restart`)
- Tears down environments after work is complete (`task env:destroy`)
- Cleans up stale environments (`task env:cleanup:stale`)
- Diagnoses deployment failures (reads events, pod descriptions, container logs)

**What the devops role does NOT do:**
- Deploy to protected environments (main, staging, production)
- Modify Helm charts or Taskfile definitions (that's application code — goes through implementer + PR)
- Manage cluster-level resources (Traefik, registry, monitoring namespace)
- Touch infrastructure provisioning (Terraform)

**Why it's a separate role:**
- The devops role needs a different skill set loaded (infrastructure skill, not code implementation skills)
- It can use a different (potentially cheaper) model — environment management doesn't need the strongest coding model
- It separates concerns cleanly: the implementer writes code, the devops role deploys and monitors it
- The allowed tools are different: the devops role primarily uses `Bash` (to run tasks) and `Read` (to interpret output), not `Write`/`Edit`

### How the Agent Uses Tasks

The agent's soul and infrastructure skill explicitly instruct it to use Taskfile commands for all operations:

```markdown
# From skills/infrastructure/SKILL.md

## Rules

- NEVER run raw kubectl, helm, or docker commands directly
- ALL infrastructure operations go through Taskfile tasks
- Use `task --list` to discover available commands
- Use `task env:*` for all sandbox environment operations

## Common Operations

| I want to... | Run this |
|--------------|----------|
| Build images from my worktree | `task env:build -- {task-id}` |
| Deploy my sandbox environment | `task env:create -- {task-id}` |
| Check if everything is healthy | `task env:health -- {task-id}` |
| View backend logs | `task env:logs -- {task-id} backend` |
| View only errors | `task env:logs:errors -- {task-id}` |
| Check pod status | `task env:status -- {task-id}` |
| Restart a broken service | `task env:restart -- {task-id} backend` |
| Tear it all down | `task env:destroy -- {task-id}` |
| Run database query | `task env:db:query -- {task-id} "SELECT ..."` |
| Clean up old environments | `task env:cleanup:stale -- 24` |
```

This means if the Taskfile changes (e.g., switching from Helm to Kustomize, or adding a new service to the stack), the agent's behavior automatically updates. The agent never needs to learn new infrastructure commands — it just runs tasks.

---

## Agent Roles Summary

THE Dev Team operates with **9 distinct roles**, each with a specific responsibility, skill set, and tool access pattern. All roles default to Claude Code (Anthropic) but can be individually overridden to use OpenCode with any model.

| Role | Responsibility | Primary Tools | Loaded Skills |
|------|---------------|---------------|---------------|
| **architect** | Understands the full codebase, creates detailed implementation plans and task trees | Read, Grep, Glob (read-only, full codebase access) | decompose |
| **implementer** | Writes code, creates features, fixes bugs according to the architect's plan | Read, Write, Edit, Bash, Grep, Glob | execute, database |
| **reviewer** | Reviews code for correctness, security, best practices; writes findings to state file | Read, Write, Grep, Glob | execute |
| **tester** | Writes and maintains unit tests and integration tests against live environment | Read, Write, Edit, Bash, Grep, Glob | api-test |
| **designer** | Designs and implements frontend UI, writes Playwright E2E tests, enforces design system (needs vision) | Read, Write, Edit, Bash (Playwright), Grep, Glob | design-review, e2e-test |
| **bugfixer** | Fixes bugs found by reviewer/tester — reads logs, edits code, rebuilds, redeploys, verifies | Read, Write, Edit, Bash, Grep, Glob | execute, infrastructure |
| **documentarian** | Writes and updates documentation, README, comments | Read, Write, Edit, Grep, Glob | execute |
| **monitor** | Monitors CI pipelines, diagnoses and fixes failures | Read, Bash, Grep | monitor, github |
| **devops** | Builds, deploys, monitors sandbox environments via Taskfile | Bash (task commands), Read | infrastructure |

---

## Inter-Role Communication

Roles communicate through the filesystem — no database, no message queue. State files and finding documents are the protocol.

### State Files

Each task has a state directory that roles read and write to:

```
.the-dev-team/state/
└── {task-id}/
    ├── status.json              ← Current task status, updated by orchestrator
    ├── plan.md                  ← Architect's implementation plan
    ├── findings/
    │   ├── reviewer.md          ← Reviewer's findings (if any)
    │   ├── tester.md            ← Tester's findings (if any)
    │   └── designer.md          ← Designer's findings (if any)
    └── gate-results/
        ├── build.json           ← Gate pass/fail + output
        ├── unit-tests.json
        ├── deployment.json
        └── ...
```

### Communication Flow

The pattern is simple: roles write findings, the orchestrator watches for them, and dispatches the bugfixer when issues are found.

```
Reviewer runs → finds 2 bugs → writes findings/reviewer.md:
  "1. SQL injection vulnerability in profile query (line 45 of profile.service.ts)
   2. Missing null check on avatar upload (line 78 of profile.controller.ts)"

Orchestrator sees findings exist → dispatches bugfixer role:
  "Read the review findings at .the-dev-team/state/{task-id}/findings/reviewer.md
   and fix all issues. Rebuild, redeploy, and verify."

Bugfixer reads findings → fixes code → rebuilds → redeploys → verifies →
  clears the findings file (or marks issues as resolved)

Orchestrator sees findings cleared → continues to next phase
```

### The Bugfixer Role

The **bugfixer** is a specialized role that combines implementation and devops capabilities. It exists specifically to close the feedback loop without requiring a full re-run of the pipeline:

**What it does:**
- Reads findings from reviewer, tester, or designer
- Makes targeted code fixes
- Rebuilds and redeploys via Taskfile (`task env:build`, `task env:create`)
- Reads logs to verify fixes
- Validates the specific issue is resolved
- Marks findings as resolved in the state file

**Why it's separate from the implementer:**
- The implementer works from the architect's plan — it creates new things
- The bugfixer works from findings — it fixes broken things
- The bugfixer needs devops tools (log reading, rebuild, redeploy) that the implementer doesn't
- It prevents the full pipeline from re-running for every small fix

**When it's triggered:**
- After the reviewer writes findings
- After the tester's tests fail (test output becomes the finding)
- After the designer flags visual issues
- NOT after every gate failure (gates have their own retry logic within the role that ran them)

### Iteration Budget

To prevent infinite fix loops:
- Maximum 3 bugfixer iterations per finding source (reviewer, tester, designer)
- After 3 iterations, the task is escalated to the human with full context
- Each iteration is a new session transcript — fully auditable

---

## Validation System

Validation is the core differentiator. THE Dev Team doesn't guess — it proves.

### Validation Gates

Every task must pass all applicable gates before a PR is submitted. Gates are ordered from fastest to slowest, failing fast when possible:

```
Gate 1: BUILD                    (~30s)
  Does it compile? Does the Docker image build?

Gate 2: UNIT TESTS               (~60s)
  Do isolated unit tests pass?

Gate 3: DEPLOYMENT                (~60-90s)
  Does the full stack come up healthy in its namespace?

Gate 4: INTEGRATION TESTS        (~60s)
  Do tests that hit real services pass?

Gate 5: LOG AUDIT                 (~10s)
  Are there any errors in backend or frontend logs after deployment?

Gate 6: API VALIDATION            (~30s)
  Do all API endpoints return expected status codes and shapes?

Gate 7: DATABASE VALIDATION       (~15s)
  Is the schema correct? Are seed/migration states right?

Gate 8: E2E TESTS                 (~2-5m)
  Do Playwright tests against the deployed environment pass?

Gate 9: ACCESSIBILITY AUDIT       (~30s)
  Does axe-core report zero WCAG AA violations?

Gate 10: DESIGN REVIEW            (~2-3m)
  Does the UI pass visual and design system validation?

Gate 11: PERFORMANCE CHECK        (~1-2m)
  Are response times within thresholds? Any regressions?
```

Each gate follows the same pattern:
1. Run the check
2. If pass → move to next gate
3. If fail → agent receives structured feedback → fixes code → rebuilds → redeploys → re-runs from the earliest affected gate

The agent has a **retry budget** per gate (configurable, default 3 attempts). If exhausted, the task is escalated to human review with full diagnostic context.

### Log Observability

The agent reads logs from its deployed environment to diagnose issues:

```bash
# Backend logs (structured JSON)
kubectl logs -n env-{task-id} deployment/backend --tail=500

# Frontend container logs (nginx access/error)
kubectl logs -n env-{task-id} deployment/frontend --tail=200

# Database logs (connection issues, slow queries)
kubectl logs -n env-{task-id} statefulset/database --tail=200
```

**Requirement**: The application must emit structured JSON logs. This is non-negotiable for agent effectiveness. Each log entry should include:
- `timestamp`
- `level` (error, warn, info, debug)
- `message`
- `requestId` (for tracing)
- `context` (module/service name)
- `stack` (for errors)
- `duration` (for performance-relevant operations)

The agent parses these logs programmatically. Unstructured `console.log` output is nearly useless to it.

### API Validation

The agent validates API endpoints against the deployed environment:

```bash
# Health check
curl -sf http://backend.env-{task-id}.svc.cluster.local:8085/health

# Endpoint validation (response shape, status codes)
curl -s http://backend.env-{task-id}.svc.cluster.local:8085/api/users | jq .

# Contract testing (if OpenAPI spec exists)
# Compare response against spec
```

The agent can also write and run HTTP-based integration tests that exercise the real API.

### Database Validation

```bash
# Schema check
kubectl exec -n env-{task-id} statefulset/database -- \
  psql -U postgres -d application -c "\dt"

# Data integrity
kubectl exec -n env-{task-id} statefulset/database -- \
  psql -U postgres -d application -c "SELECT count(*) FROM users;"

# Migration status
kubectl exec -n env-{task-id} statefulset/database -- \
  psql -U postgres -d application -c "SELECT * FROM migrations ORDER BY timestamp DESC LIMIT 5;"
```

### Frontend Validation

The agent uses Playwright to interact with and validate the frontend:

#### Console and Network Monitoring

```typescript
const errors: string[] = [];
const failedRequests: string[] = [];

page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

page.on("pageerror", (err) => errors.push(err.message));

page.on("response", (response) => {
  if (response.status() >= 400) {
    failedRequests.push(`${response.status()} ${response.url()}`);
  }
});

await page.goto("http://app.env-{task-id}.localhost/dashboard");

// After interaction, assert no errors
expect(errors).toHaveLength(0);
expect(failedRequests).toHaveLength(0);
```

#### Accessibility Tree (non-visual page understanding)

```typescript
const snapshot = await page.accessibility.snapshot();
// Returns a structured tree the LLM can reason about:
// { role: 'WebArea', name: 'Dashboard', children: [
//   { role: 'heading', name: 'Users', level: 1 },
//   { role: 'table', name: 'User List', children: [...] },
//   { role: 'button', name: 'Add User' },
// ]}
```

This gives the agent a text-based representation of the page without needing screenshots. Useful for structural validation.

#### Screenshot Capture for Visual Review

```typescript
const breakpoints = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

for (const bp of breakpoints) {
  await page.setViewportSize({ width: bp.width, height: bp.height });
  await page.screenshot({
    path: `validation/${bp.name}-dashboard.png`,
    fullPage: true,
  });
}
```

#### UI State Validation

The agent validates all UI states, not just the happy path:

```typescript
// Loading state (slow network)
await page.route("**/api/users", async (route) => {
  await new Promise((r) => setTimeout(r, 3000));
  route.continue();
});
await page.screenshot({ path: "validation/loading-state.png" });
// Review: are skeleton placeholders showing? No spinner?

// Empty state (no data)
await page.route("**/api/users", (route) =>
  route.fulfill({
    status: 200,
    body: JSON.stringify([]),
    contentType: "application/json",
  })
);
await page.reload();
await page.screenshot({ path: "validation/empty-state.png" });
// Review: centered message + CTA? Not a blank page?

// Error state (API failure)
await page.route("**/api/users", (route) => route.fulfill({ status: 500 }));
await page.reload();
await page.screenshot({ path: "validation/error-state.png" });
// Review: user-friendly error message? Retry button?

// Form validation states
await page.click('[data-testid="submit-button"]');
await page.screenshot({ path: "validation/form-errors.png" });
// Review: inline validation messages? Correct error colors?
```

### Accessibility Validation

Automated WCAG AA compliance checking via axe-core:

```typescript
import AxeBuilder from "@axe-core/playwright";

const results = await new AxeBuilder({ page })
  .withTags(["wcag2a", "wcag2aa"])
  .analyze();

if (results.violations.length > 0) {
  // Agent receives structured violations:
  // - "Button has no accessible name" (element selector, impact, fix suggestion)
  // - "Color contrast ratio 2.1:1 is below required 4.5:1"
  // - "Form input missing associated label"
  // Agent fixes each violation and re-runs
}
```

---

## The Designer Role and Design Validation

The **designer** is a full creative and engineering role, not just a reviewer. It is responsible for:

1. **Implementing frontend UI** — building components, pages, and layouts that follow the design system
2. **Writing Playwright E2E tests** — authoring end-to-end tests that validate user flows against the deployed environment
3. **Design system enforcement** — reviewing all frontend output (its own and the implementer's) for visual compliance
4. **Visual regression detection** — comparing before/after screenshots to catch unintended changes
5. **Responsive design** — ensuring layouts work across all breakpoints
6. **Accessibility** — enforcing WCAG AA compliance via automated audits
7. **UI state coverage** — validating loading, empty, error, and form validation states

The designer role needs **vision capabilities** (screenshot analysis) and is best served by a model that excels at visual reasoning. It defaults to Claude Code like all roles, but this is one role where the model choice matters — it must support multimodal input.

Design validation is a first-class gate, not an afterthought. The designer enforces the project's design system with the same rigor the tester applies to unit tests.

### Design System Rules Skill

A comprehensive skill document (`skills/design-review/SKILL.md`) encodes all design rules. This is the single source of truth for visual standards.

#### Spacing Rules
- Page margins: 24px desktop, 16px mobile
- Card padding: 16px
- Section spacing: 32px between sections, 8px between related elements
- Never stack elements with zero spacing
- Consistent use of `theme.spacing()` — no hardcoded pixel values

#### Typography Rules
- Page titles: h4 (34px), font-weight 400
- Section headers: h6 (20px), font-weight 500
- Body text: body1 (16px)
- Captions: caption (12px), `text.secondary` color
- Maximum 3 type sizes per view
- All typography via `theme.typography.*` — no inline font styles

#### Color Rules
- Primary actions: `theme.palette.primary`
- Destructive actions: `theme.palette.error`
- Success states: `theme.palette.success`
- Maximum 2 background colors per view
- All text on colored backgrounds must pass WCAG AA contrast (4.5:1)
- No hardcoded color values — everything through `theme.palette`

#### Layout Rules
- Max content width: 1200px, centered
- Card grids: consistent heights per row
- Forms: labels above inputs (not beside, except toggles)
- Tables: right-align numbers, left-align text
- Empty states: centered illustration + message + CTA

#### Component Rules
- Data lists: MUI `DataGrid`, not custom tables
- Forms: controlled `TextField` with proper validation states
- Navigation: top `AppBar` + side `Drawer`, not tabs for primary nav
- Modals: max 600px width, always have a close button
- Loading: skeleton placeholders for content areas, never spinners
- Toasts/snackbars: bottom-left, auto-dismiss after 5s (except errors)

#### Things That Are Always Wrong
- Horizontal scrolling on any viewport
- Text truncation without tooltip
- Clickable elements smaller than 44x44px touch target
- More than 3 levels of visual nesting
- Inconsistent border-radius (project standard: 8px)
- Mixed icon libraries (pick one, stick with it)
- Orphaned labels or headings with no content below them
- Buttons with only icons and no aria-label

### Design Review Process

After the agent deploys its changes, it runs a multi-step design review:

**Step 1: Code-Level Linting**
Static analysis of the React/MUI code:
- No raw HTML elements where MUI components exist (`<button>` → `<Button>`)
- No inline `style=` props with hardcoded values
- No direct color hex/rgb values
- All spacing via `theme.spacing()` or `sx` prop with theme tokens
- Correct MUI component variant usage

**Step 2: Screenshot Capture**
Screenshots at all defined breakpoints (mobile, tablet, desktop) for every page the agent modified or created. Also: dark mode variants if the app supports theming.

**Step 3: Visual Review via Claude Vision**
Each screenshot is sent to Claude with the design rules skill as context:

```
"Here is a screenshot of the page I built at {breakpoint} viewport.
Here is the accessibility tree for structural context.
Here are our design system rules: {skill content}

Review this page for design compliance. For each violation found:
1. What rule is violated
2. Where on the page (describe the element/area)
3. What the fix should be
4. Severity: blocking (must fix) vs advisory (should fix)"
```

**Step 4: Reference Comparison**
For pages that already exist (modifications, not new pages):
- Capture a "before" screenshot from the main branch deployment
- Capture an "after" screenshot from the agent's namespace
- Compare: "I modified the user list component. Here is before and after. Identify any unintended visual regressions outside the area I was working on."

**Step 5: Interactive State Review**
Screenshots of all interactive states (loading, empty, error, form validation, hover states where applicable). Each state is reviewed against the design rules.

**Step 6: Responsive Coherence**
Cross-breakpoint comparison: "Here is the same page at mobile, tablet, and desktop. Is the layout coherent across breakpoints? Do elements reflow logically? Is anything hidden on mobile that shouldn't be?"

### Design Review Gate Behavior

- All "blocking" violations must be fixed before the PR is submitted
- "Advisory" violations are listed in the PR description for human review
- The agent iterates: fix violation → rebuild → redeploy → re-screenshot → re-review
- Maximum 3 design review iterations before escalation

---

## Performance Validation

### Baseline Metrics

The orchestrator maintains baseline performance metrics for the application (captured from the main branch deployment):

- API response times: p50, p95, p99 per endpoint
- Frontend load time: Time to Interactive, Largest Contentful Paint
- Database query times: p50, p95 for common queries
- Memory usage: baseline pod memory consumption

### Agent Performance Checks

**API Performance:**
```bash
# Simple latency check per endpoint
for endpoint in /api/health /api/users /api/auth/profile; do
  curl -w '%{time_total}' -o /dev/null -s \
    http://backend.env-{task-id}.svc.cluster.local:8085${endpoint}
done
```

**Load Test (lightweight):**
```bash
# Quick load test with autocannon or k6
# Compare results against baseline thresholds
npx autocannon -c 10 -d 15 \
  http://backend.env-{task-id}.svc.cluster.local:8085/api/users
```

**Frontend Performance:**
```typescript
// Playwright performance metrics
const metrics = await page.evaluate(() => {
  const perf = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
  return {
    ttfb: perf.responseStart - perf.requestStart,
    domContentLoaded: perf.domContentLoadedEventEnd - perf.navigationStart,
    load: perf.loadEventEnd - perf.navigationStart,
  };
});

// Lighthouse-style audit via Playwright
const lcp = await page.evaluate(() => {
  return new Promise((resolve) => {
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      resolve(entries[entries.length - 1].startTime);
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });
});
```

**Regression Detection:**
The agent compares its metrics against baselines. If any metric regresses beyond a configurable threshold (default: 20% slower), the performance gate fails and the agent investigates.

### Future: Observability Stack

Phase 3 enhancement — a shared monitoring namespace:

```
Namespace: monitoring
├── prometheus        (metrics collection)
├── grafana          (dashboards, queryable by agent)
├── loki             (log aggregation, queryable via LogQL)
└── tempo            (distributed tracing, optional)
```

Each application namespace exports metrics to the shared Prometheus. The agent queries Prometheus/Loki APIs directly for deep analysis. This replaces raw `kubectl logs` with structured, queryable observability.

---

## Task Lifecycle

### Task Sources

Tasks enter THE Dev Team from multiple sources:

1. **GitHub Issues**: Labeled issues (e.g., `the-dev-team`) are picked up automatically
2. **Manual Queue**: Human submits tasks via the orchestrator API or dashboard
3. **Decomposition**: A plan is decomposed into a task tree; leaf tasks are queued
4. **PR Review Feedback**: Reviewer comments on a PR trigger re-work tasks
5. **CI Failure**: A failing CI check triggers a fix task on the relevant branch

### Task States

```
┌──────────┐     ┌────────────┐     ┌────────────┐
│  QUEUED  │────▶│ ASSIGNED   │────▶│ SETTING UP │
└──────────┘     └────────────┘     └────────────┘
                                          │
                                          ▼
┌──────────┐     ┌────────────┐     ┌────────────────┐
│ESCALATED │◀────│ VALIDATING │◀────│ IMPLEMENTING   │
└──────────┘     └────────────┘     └────────────────┘
     │                │                    │
     │                ▼                    │
     │          ┌────────────┐             │
     │          │ SUBMITTING │             │
     │          └────────────┘             │
     │                │                    │
     │                ▼                    │
     │          ┌────────────┐             │
     │          │ COMPLETED  │             │
     │          └────────────┘             │
     │                                     │
     ▼                                     ▼
┌──────────────────────────────────────────────┐
│  FAILED (retry budget exhausted, needs human)│
└──────────────────────────────────────────────┘
```

### Task Decomposition

Large features are decomposed into a task tree before execution:

```
Feature: User Profile Page
├── Backend
│   ├── Create user profile entity and migration
│   ├── Create profile API endpoints (GET, PUT)
│   └── Add profile image upload endpoint
├── Frontend
│   ├── Create profile page component
│   ├── Create profile edit form
│   └── Add avatar upload component
├── E2E
│   └── Write Playwright tests for profile flow
└── Dependencies:
    Backend entity → Backend API → Frontend page → E2E tests
```

Each leaf task is an atomic unit of work that one agent can complete independently. The orchestrator respects dependency ordering.

---

## PR Submission Format

When all gates pass, the agent creates a PR with a structured, evidence-rich description:

```markdown
## Summary
Brief description of what was implemented and why.

## Changes
- List of specific changes made
- Organized by area (backend, frontend, database, etc.)

## Validation Results

### Tests
- Unit tests: 47 passed, 0 failed
- Integration tests: 12 passed, 0 failed
- E2E tests: 8 passed, 0 failed

### Accessibility
- axe-core WCAG AA: 0 violations
- Touch targets: all >= 44x44px
- Color contrast: all ratios >= 4.5:1

### Performance
| Endpoint | Baseline p95 | Current p95 | Delta |
|----------|-------------|-------------|-------|
| GET /api/users | 45ms | 42ms | -7% |
| GET /api/profile | N/A | 38ms | new |

### Design Review
- Mobile: passed (screenshot attached)
- Tablet: passed (screenshot attached)
- Desktop: passed (screenshot attached)
- Advisory notes: [any non-blocking observations]

## Screenshots
[Attached at all breakpoints]

## Environment
- Branch: `feature/user-profile`
- Namespace: `env-feature-user-profile` (torn down / still live at [URL])
- Agent session: [link to session log]
```

---

## PR Review Feedback Loop

When a human reviewer leaves comments on a PR:

1. Orchestrator detects new PR comments (via GitHub webhook or polling)
2. Creates a re-work task scoped to the review feedback
3. Agent re-opens the worktree and namespace (or creates fresh ones)
4. Agent reads the review comments as task context
5. Agent makes the requested changes
6. Full validation loop runs again
7. Agent pushes new commits and comments on the PR with updated results

This continues until the reviewer approves or the task is manually closed.

---

## Concurrency Model

THE Dev Team supports multiple agents working simultaneously:

### Isolation Guarantees
- Each agent has its own git worktree (filesystem isolation)
- Each agent has its own K8s namespace (runtime isolation)
- Each agent has its own branch (version control isolation)
- Agents never share worktrees, namespaces, or branches

### Resource Management
- **Max concurrent agents**: configurable (default 4)
- **Per-agent resource limits**: configurable CPU/memory for the agent's namespace pods
- **Cluster resource awareness**: orchestrator checks available cluster resources before spawning
- **Stale environment cleanup**: scheduler periodically tears down namespaces older than a threshold

### Conflict Resolution
- If two tasks touch the same files, they are serialized (not parallelized)
- Merge conflicts on PR submission trigger a rebase + re-validation cycle
- The orchestrator tracks which files each task is likely to touch (from decomposition) to minimize conflicts

---

## History and Transcripts

Every action THE Dev Team takes is recorded. Full transcripts, structured metadata, searchable, auditable. No database — everything is files on disk, synced to a protected git branch.

### Why File-Based

- **Portability**: History is just files. Move them, grep them, read them with any tool.
- **Git-native**: Diffs show exactly what changed. Blame shows when. Branch protection ensures integrity.
- **No infrastructure dependency**: No Postgres, no Redis, no Elasticsearch to maintain. The PVC and git are the only dependencies.
- **Survives everything**: Pod restarts, cluster rebuilds, even provider migrations. As long as the git branch exists, the history exists.
- **Human-readable**: JSONL transcripts and markdown summaries can be read directly. No special tooling required.

### What Gets Recorded

Every session produces three artifacts:

#### 1. Session Transcript (JSONL)

The full, raw record of everything that happened in a session. Every message, tool call, tool result, error, and status change. One JSON object per line.

```
.the-dev-team/history/
└── sessions/
    └── 2026/
        └── 04/
            └── 01/
                ├── task-abc123-implementer-1711929600.jsonl
                ├── task-abc123-tester-1711929900.jsonl
                ├── task-abc123-designer-1711930200.jsonl
                └── task-abc123-devops-1711930500.jsonl
```

Each line in the JSONL file is a timestamped event:

```jsonl
{"ts":"2026-04-01T10:00:00.000Z","type":"session_start","taskId":"abc123","role":"implementer","provider":"claude-code","model":"claude-sonnet-4-6","branch":"the-dev-team/feature/user-profile","worktree":"/workspace/worktrees/abc123"}
{"ts":"2026-04-01T10:00:00.100Z","type":"prompt","content":"Implement the user profile page according to the following plan..."}
{"ts":"2026-04-01T10:00:02.300Z","type":"agent_message","subtype":"text","content":"I'll start by reading the existing user entity to understand the data model."}
{"ts":"2026-04-01T10:00:02.500Z","type":"tool_use","tool":"Read","input":{"file_path":"src/features/user-management/entities/user.entity.ts"}}
{"ts":"2026-04-01T10:00:02.800Z","type":"tool_result","tool":"Read","output":"[file contents...]","durationMs":300}
{"ts":"2026-04-01T10:00:04.100Z","type":"agent_message","subtype":"text","content":"Now I'll create the profile entity..."}
{"ts":"2026-04-01T10:00:04.300Z","type":"tool_use","tool":"Write","input":{"file_path":"src/features/user-profile/entities/profile.entity.ts","content":"..."}}
{"ts":"2026-04-01T10:00:04.500Z","type":"tool_result","tool":"Write","output":"File created successfully","durationMs":200}
{"ts":"2026-04-01T10:00:45.000Z","type":"gate_result","gate":"unit_tests","passed":false,"output":"FAIL src/features/user-profile/profile.service.spec.ts\n  TypeError: ...","attempt":1}
{"ts":"2026-04-01T10:00:46.000Z","type":"agent_message","subtype":"text","content":"The test failed because I forgot to register the TypeORM module. Let me fix that."}
{"ts":"2026-04-01T10:01:30.000Z","type":"gate_result","gate":"unit_tests","passed":true,"output":"Tests: 12 passed, 0 failed","attempt":2}
{"ts":"2026-04-01T10:05:00.000Z","type":"session_end","durationMs":300000,"tokensUsed":45000,"cost":0.135,"outcome":"success"}
```

**What's captured in every transcript:**
- Session start/end with full context (task, role, provider, model, branch, worktree)
- Every prompt sent to the agent
- Every agent text response (full reasoning)
- Every tool call with inputs (what the agent tried to do)
- Every tool result with outputs (what actually happened)
- Every validation gate result with pass/fail, output, and attempt number
- Every error with stack trace and context
- Token usage and cost per session
- Duration of every operation

#### 2. Task Summary (Markdown)

A human-readable summary of the complete task lifecycle, auto-generated when a task completes (or fails):

```
.the-dev-team/history/
└── tasks/
    └── 2026/
        └── 04/
            └── task-abc123-user-profile.md
```

```markdown
# Task: abc123 — User Profile Page

**Status**: completed
**Branch**: the-dev-team/feature/user-profile
**PR**: #42
**Duration**: 28 minutes
**Total Cost**: $0.87

## Timeline

| Time | Role | Action | Duration | Cost |
|------|------|--------|----------|------|
| 10:00 | architect | Created implementation plan | 2m | $0.12 |
| 10:02 | implementer | Implemented backend + frontend | 12m | $0.45 |
| 10:14 | tester | Wrote 12 unit tests, 4 integration tests | 5m | $0.15 |
| 10:19 | designer | Wrote 3 Playwright E2E tests, design review passed | 4m | $0.08 |
| 10:23 | devops | Built images, deployed to env-abc123, all healthy | 2m | $0.02 |
| 10:25 | reviewer | Code review passed, 1 advisory note | 2m | $0.03 |
| 10:27 | documentarian | Updated API docs | 1m | $0.02 |

## Validation Gates

| Gate | Result | Attempts | Notes |
|------|--------|----------|-------|
| Build | pass | 1 | |
| Unit Tests | pass | 2 | First attempt failed: missing TypeORM module registration |
| Deployment | pass | 1 | |
| Integration Tests | pass | 1 | |
| Log Audit | pass | 1 | |
| API Validation | pass | 1 | |
| Accessibility | pass | 1 | |
| Design Review | pass | 1 | 1 advisory: consider larger touch target on mobile back button |
| Performance | pass | 1 | GET /api/profile: 38ms p95 |

## Files Changed
- `src/features/user-profile/entities/profile.entity.ts` (new)
- `src/features/user-profile/profile.service.ts` (new)
- `src/features/user-profile/profile.controller.ts` (new)
- `src/features/user-profile/profile.module.ts` (new)
- `src/features/user-profile/profile.service.spec.ts` (new)
- `e2e/user-profile.spec.ts` (new)
- `src/app.module.ts` (modified)

## Session Transcripts
- [architect](sessions/2026/04/01/task-abc123-architect-1711929500.jsonl)
- [implementer](sessions/2026/04/01/task-abc123-implementer-1711929600.jsonl)
- [tester](sessions/2026/04/01/task-abc123-tester-1711929900.jsonl)
- [designer](sessions/2026/04/01/task-abc123-designer-1711930200.jsonl)
- [devops](sessions/2026/04/01/task-abc123-devops-1711930500.jsonl)
- [reviewer](sessions/2026/04/01/task-abc123-reviewer-1711930700.jsonl)
- [documentarian](sessions/2026/04/01/task-abc123-documentarian-1711930800.jsonl)
```

#### 3. Orchestrator Event Log (JSONL)

A system-level log of orchestrator decisions — task assignment, agent lifecycle, environment creation/teardown, errors. Not tied to any single task.

```
.the-dev-team/history/
└── orchestrator/
    └── 2026/
        └── 04/
            └── 01.jsonl
```

```jsonl
{"ts":"2026-04-01T09:59:00.000Z","type":"task_received","taskId":"abc123","source":"github_issue","issueNumber":15}
{"ts":"2026-04-01T09:59:01.000Z","type":"task_assigned","taskId":"abc123","agentSlot":1,"branch":"the-dev-team/feature/user-profile"}
{"ts":"2026-04-01T09:59:02.000Z","type":"worktree_created","taskId":"abc123","path":"/workspace/worktrees/abc123"}
{"ts":"2026-04-01T10:23:00.000Z","type":"namespace_created","taskId":"abc123","namespace":"env-abc123"}
{"ts":"2026-04-01T10:28:00.000Z","type":"pr_created","taskId":"abc123","prNumber":42,"prUrl":"https://github.com/..."}
{"ts":"2026-04-01T10:28:30.000Z","type":"namespace_destroyed","taskId":"abc123","namespace":"env-abc123"}
{"ts":"2026-04-01T10:28:31.000Z","type":"worktree_removed","taskId":"abc123"}
{"ts":"2026-04-01T10:28:32.000Z","type":"task_completed","taskId":"abc123","durationMs":1772000,"totalCost":0.87}
```

### Directory Structure

```
.the-dev-team/
└── history/
    ├── sessions/              ← Raw JSONL transcripts (one file per role per task)
    │   └── 2026/
    │       └── 04/
    │           └── 01/
    │               ├── task-abc123-architect-{ts}.jsonl
    │               ├── task-abc123-implementer-{ts}.jsonl
    │               └── ...
    ├── tasks/                 ← Human-readable task summaries (markdown)
    │   └── 2026/
    │       └── 04/
    │           ├── task-abc123-user-profile.md
    │           └── task-def456-bug-fix-auth.md
    ├── orchestrator/          ← System-level event log
    │   └── 2026/
    │       └── 04/
    │           ├── 01.jsonl
    │           └── 02.jsonl
    └── index.jsonl            ← Lightweight task index for fast lookups
```

### The Index File

`index.jsonl` is a lightweight lookup table — one line per task, appended as tasks complete. This avoids needing to scan hundreds of markdown files to find a task:

```jsonl
{"taskId":"abc123","title":"User Profile Page","status":"completed","branch":"the-dev-team/feature/user-profile","pr":42,"startedAt":"2026-04-01T10:00:00Z","completedAt":"2026-04-01T10:28:32Z","durationMs":1772000,"cost":0.87,"roles":["architect","implementer","tester","designer","devops","reviewer","documentarian"],"summaryPath":"tasks/2026/04/task-abc123-user-profile.md"}
{"taskId":"def456","title":"Fix auth token expiry","status":"completed","branch":"the-dev-team/bugfix/auth-expiry","pr":43,"startedAt":"2026-04-01T11:00:00Z","completedAt":"2026-04-01T11:15:00Z","durationMs":900000,"cost":0.22,"roles":["architect","implementer","tester","reviewer"],"summaryPath":"tasks/2026/04/task-def456-bug-fix-auth.md"}
{"taskId":"ghi789","title":"Add dark mode","status":"failed","branch":"the-dev-team/feature/dark-mode","pr":null,"startedAt":"2026-04-01T12:00:00Z","completedAt":"2026-04-01T12:45:00Z","durationMs":2700000,"cost":0.95,"roles":["architect","implementer","designer"],"failureReason":"Design review gate: 3 attempts exhausted","summaryPath":"tasks/2026/04/task-ghi789-dark-mode.md"}
```

### Persistence: PVC → Protected Git Branch

The history files live in two places:

**1. Live on the PVC** (primary, always up to date):
- The orchestrator writes transcripts directly to `.the-dev-team/history/` on the persistent volume
- JSONL files are append-only — a crash mid-write loses at most one line
- This is the working copy the orchestrator reads from for dashboards, search, etc.

**2. Synced to a protected git branch** (backup, auditable):
- A dedicated branch `the-dev-team/history` stores the history in git
- This branch is protected — only the sync mechanism can push to it
- The history is version-controlled, so you can see when entries were added

### Sync Mechanism

The orchestrator does NOT push to the history branch directly (it uses the bot account which is restricted to `the-dev-team/*` task branches). Instead, syncing uses one of two approaches:

**Option A: GitHub Action (recommended)**

A scheduled GitHub Action runs periodically (e.g., every 15 minutes) and on task completion webhooks:

```yaml
# .github/workflows/sync-history.yml
name: Sync Dev Team History

on:
  schedule:
    - cron: '*/15 * * * *'        # Every 15 minutes
  workflow_dispatch:               # Manual trigger
  repository_dispatch:
    types: [history-sync]          # Triggered by orchestrator webhook

jobs:
  sync:
    runs-on: self-hosted           # Runs on the K8s node / mac-mini
    steps:
      - uses: actions/checkout@v4
        with:
          ref: the-dev-team/history
          fetch-depth: 0

      - name: Copy history from PVC
        run: |
          # The runner has access to the PVC mount (or copies via kubectl)
          rsync -av /workspace/.the-dev-team/history/ .the-dev-team/history/

      - name: Commit and push
        run: |
          git config user.name "THE Dev Team History Bot"
          git config user.email "the-dev-team-history@noreply"
          git add .the-dev-team/history/
          # Only commit if there are changes
          git diff --cached --quiet || \
            git commit -m "sync: history update $(date -u +%Y-%m-%dT%H:%M:%SZ)"
          git push origin the-dev-team/history
```

**Option B: Orchestrator Sync Service**

A dedicated sync service in the orchestrator with a separate, narrowly-scoped token that can only push to the `the-dev-team/history` branch:

```typescript
class HistorySyncService {
  // Runs on a timer (every 15 minutes) and on task completion
  async sync() {
    const historyDir = "/workspace/.the-dev-team/history";
    const repo = "/workspace/.the-dev-team/history-repo";  // Sparse checkout of history branch

    await exec(`git -C ${repo} pull --rebase origin the-dev-team/history`);
    await exec(`rsync -av ${historyDir}/ ${repo}/.the-dev-team/history/`);
    await exec(`git -C ${repo} add .`);

    const hasChanges = await exec(`git -C ${repo} diff --cached --quiet`)
      .then(() => false)
      .catch(() => true);

    if (hasChanges) {
      await exec(`git -C ${repo} commit -m "sync: history update ${new Date().toISOString()}"`);
      await exec(`git -C ${repo} push origin the-dev-team/history`);
    }
  }
}
```

This uses a **separate GitHub token** (`HISTORY_SYNC_TOKEN`) that is scoped to push only to the `the-dev-team/history` branch via a branch ruleset. It is NOT the same token the agent uses for task branches.

**Option A is recommended** because:
- The sync runs outside the agent's security boundary
- The GitHub Action uses `GITHUB_TOKEN` which has repo write access by default
- No additional token management needed
- The schedule is reliable and auditable in GitHub's Actions UI
- The `repository_dispatch` trigger lets the orchestrator request an immediate sync after task completion

### Branch Protection for History

```
Branch ruleset: the-dev-team/history
├── Allow push: GitHub Actions only (or the history sync token)
├── Deny push: the-dev-team-bot (agent cannot write history directly)
├── Deny push: all other users
├── Deny delete: everyone
└── Deny force push: everyone
```

The agent cannot tamper with its own history. It writes transcripts to the PVC (which it needs to do its job), but the git sync is handled by a separate mechanism with separate credentials.

### Searching History

Since everything is files, standard tools work:

```bash
# Find all tasks that failed
grep '"status":"failed"' .the-dev-team/history/index.jsonl

# Find all sessions where the designer role was used
ls .the-dev-team/history/sessions/2026/04/01/*-designer-*

# Find a specific error across all transcripts
grep -r '"type":"error"' .the-dev-team/history/sessions/2026/04/

# Find all gate failures for a specific task
grep '"gate_result"' .the-dev-team/history/sessions/2026/04/01/task-abc123-*.jsonl | jq 'select(.passed == false)'

# Get total cost for a date range
jq -s '[.[].cost] | add' .the-dev-team/history/tasks/2026/04/task-*.md  # (from index.jsonl instead)
grep '2026-04' .the-dev-team/history/index.jsonl | jq -s '[.[].cost] | add'

# Find all tasks that touched a specific file
grep -l 'profile.entity.ts' .the-dev-team/history/tasks/2026/04/*.md
```

The orchestrator also exposes history via its API and the dashboard, but the raw files are always available for ad-hoc investigation.

### Taskfile Commands for History

```yaml
# In the Taskfile — history operations

tasks:
  history:search:
    desc: Search transcripts for a pattern
    # Usage: task history:search -- "TypeError"
    cmds:
      - grep -rn "{{.CLI_ARGS}}" .the-dev-team/history/sessions/ | head -50

  history:task:
    desc: Show summary for a specific task
    # Usage: task history:task -- abc123
    cmds:
      - cat .the-dev-team/history/tasks/*/task-{{.CLI_ARGS}}-*.md

  history:sessions:
    desc: List all session transcripts for a task
    # Usage: task history:sessions -- abc123
    cmds:
      - ls -la .the-dev-team/history/sessions/*/*/task-{{.CLI_ARGS}}-*

  history:tail:
    desc: Follow the latest orchestrator events
    cmds:
      - tail -f .the-dev-team/history/orchestrator/$(date +%Y/%m/%d).jsonl | jq .

  history:costs:
    desc: Show total costs for a date (default today)
    # Usage: task history:costs -- 2026-04-01
    cmds:
      - |
        DATE={{.CLI_ARGS:-$(date +%Y-%m-%d)}}
        grep "$DATE" .the-dev-team/history/index.jsonl | jq -s '{
          tasks: length,
          totalCost: ([.[].cost] | add),
          avgDuration: (([.[].durationMs] | add) / length / 60000 | floor | tostring + " minutes"),
          completed: ([.[] | select(.status == "completed")] | length),
          failed: ([.[] | select(.status == "failed")] | length)
        }'

  history:sync:
    desc: Trigger an immediate history sync to git
    cmds:
      - |
        curl -X POST \
          -H "Authorization: token ${GITHUB_TOKEN}" \
          -H "Accept: application/vnd.github.v3+json" \
          https://api.github.com/repos/${GITHUB_REPO}/dispatches \
          -d '{"event_type":"history-sync"}'

  history:failures:
    desc: Show recent failures with reasons
    cmds:
      - grep '"status":"failed"' .the-dev-team/history/index.jsonl | tail -10 | jq '{taskId, title, failureReason, cost}'
```

### Retention

History files accumulate over time. Retention policy:

- **Session transcripts**: Keep for 90 days on the PVC, indefinitely on the git branch
- **Task summaries**: Keep indefinitely (small, high value)
- **Orchestrator logs**: Keep for 30 days on the PVC, indefinitely on the git branch
- **Index**: Append-only, never truncated

A scheduled task handles PVC cleanup:

```yaml
  history:cleanup:
    desc: Remove session transcripts older than N days from PVC (git branch retains all)
    # Usage: task history:cleanup -- 90
    cmds:
      - find .the-dev-team/history/sessions/ -name "*.jsonl" -mtime +{{.CLI_ARGS}} -delete
      - echo "Cleaned up transcripts older than {{.CLI_ARGS}} days from PVC"
      - echo "Full history remains on the-dev-team/history branch"
```

---

## Dashboard

A real-time web dashboard shows the state of THE Dev Team:

### Views

**Overview**: All active agents, their current task, current gate, progress percentage

**Agent Detail**: Live streaming of an agent's work — what it's reading, writing, building, testing. Claude Code SDK message stream piped to the UI via WebSocket.

**Task Board**: Kanban-style view of all tasks (queued, in progress, validating, completed, failed)

**Environment Map**: All active K8s namespaces with health status, resource usage, ingress URLs

**PR Pipeline**: All open PRs created by THE Dev Team, their CI status, review status, linked environment

**History Browser**: Searchable archive of all past tasks. Click a task to see its summary, timeline, gate results, and full session transcripts. Filter by date, status, role, cost.

**Session Replay**: Open a session transcript and step through it chronologically — see exactly what the agent thought, what it tried, what succeeded, what failed. Like a debugger for agent behavior.

**Metrics**: Historical view of agent success rates, average time per task, common failure modes, retry rates, cost trends over time

---

## Evolution Roadmap

### Phase 1: Foundation
- Minikube + Nix local setup (no Docker Desktop)
- Orchestrator with single-agent execution
- Git worktree + branch workflow
- Namespace-per-environment deployment
- Basic validation gates: build, unit tests, E2E, log audit
- Manual task submission
- Session transcripts (JSONL) and task summaries (markdown)
- History sync to protected git branch
- Taskfile commands for all operations (env:*, history:*)

### Phase 2: Full Validation
- Design review gate with Claude Vision
- Accessibility audit gate (axe-core)
- Performance validation gate
- API and database validation gates
- Screenshot capture at all breakpoints
- Structured PR descriptions with evidence

### Phase 3: Intelligence
- Task decomposition from plans/issues
- Multi-agent concurrency with conflict detection
- PR review feedback loop
- Reference screenshot comparison (before/after)
- UI state validation (loading, empty, error states)
- Real-time dashboard

### Phase 4: Scale
- Shared observability stack (Prometheus, Loki, Grafana)
- Baseline performance tracking and regression detection
- Auto-scaling agent count based on queue depth
- Preview URLs for PR reviewers (live environments)
- GitHub issue auto-triage and task creation
- Cross-task dependency graph execution

### Phase 5: Self-Improvement
- Agent tracks its own failure modes and common fixes
- Design rules auto-updated when PRs are rejected for visual issues
- Test coverage gaps identified and backfilled
- Performance baselines auto-updated after merges
- Agent suggests architecture improvements based on patterns it sees

---

## What Gets Dropped from the Current Repo

| Remove | Reason |
|--------|--------|
| `projects/openclaw/` | THE Dev Team replaces this entirely |
| `projects/coding-agent/frontend/` (Angular) | Replace with a simpler dashboard (React, consistent with main app) |
| Docker Compose for dev services | Everything runs in K8s (minikube locally) |
| Mastra agent framework | Replaced by `CodingAgentProvider` abstraction |
| `@ai-sdk/*` packages | Replaced by Claude Code SDK + OpenCode behind the provider interface |
| OpenClaw dependencies | Not needed |

## What Gets Kept and Evolved

| Keep | Evolution |
|------|-----------|
| `projects/application/` | The product being developed — untouched |
| `projects/coding-agent/backend/` | Becomes THE Dev Team orchestrator |
| Multi-model concept | Reimagined as role-based provider config (implementer, reviewer, documentarian, etc.) |
| All Helm charts | Extended with parameterized namespace support |
| Terraform + K3s | Production cluster provisioning |
| Nix flake | Extended with minikube, Docker engine |
| In-cluster registry | Image storage for all environments |
| Traefik | Wildcard ingress for dynamic namespaces |
| RBAC on agent pod | Agent needs full K8s access for namespace lifecycle |
| Backlog/decomposition data model | Task tree structure, dependency tracking |
| WebSocket real-time architecture | Agent progress streaming to dashboard |
| Playwright setup | Foundation for frontend validation |
| The 5 OpenClaw skill definitions | Ported as orchestrator skill templates |

---

## Naming Conventions

- **Project**: THE Dev Team
- **Orchestrator service**: `the-dev-team` (K8s deployment name)
- **Agent namespaces**: `env-{task-id}` (e.g., `env-feature-user-profile`)
- **Branches**: `the-dev-team/{task-type}/{short-description}` (e.g., `the-dev-team/feature/user-profile`)
- **PRs**: Prefixed with `[THE Dev Team]` in title
- **Docker images**: `the-dev-team-orchestrator`, plus standard app images
- **Helm release names**: `{task-id}` within agent namespaces

---

## Known Gaps and Future Work

Identified during architecture review. These are real gaps that need to be addressed as the system matures, but are not blockers for Phase 1.

### Gap 1: Crash Recovery and Resilience

**Status**: Needs design

The document doesn't cover what happens when things go sideways at the infrastructure level:

- **Orchestrator pod crashes mid-task**: The agent was halfway through implementation. How does it resume? The session manager is mentioned but the recovery mechanics aren't defined. The Claude Code SDK supports session resume — need to wire that into the orchestrator's state management so it can pick up where it left off.
- **PVC data corruption**: If the worktree or history gets corrupted, what's the recovery path? Git worktrees can be recreated from the branch. History is synced to the git branch. But the orchestrator state (which tasks are active, which namespaces are up) needs a reconciliation mechanism.
- **K8s node restart**: Minikube or K3s restarts. Namespaces and PVCs survive, but do the agent sessions reconnect? The orchestrator needs a startup reconciliation loop that discovers existing `env-*` namespaces and in-progress tasks.
- **Orphaned resources**: If the orchestrator crashes between deploying a namespace and recording it, that namespace is a ghost. The stale cleanup cron helps, but a reconciliation loop on startup should also discover orphans by scanning `env-*` namespaces and comparing against the task index.

### Gap 2: Architect Role Depth

**Status**: Will polish once system is running

The architect is the most important role but the least defined:

- **How does it "understand the full codebase"?** Context windows have limits. Might need a codebase summary/map, or a multi-pass approach where it reads high-level structure first, then dives into relevant areas.
- **What format does the plan take?** The decompose skill exists but the plan output format isn't specified.
- **How detailed is the plan?** Does it specify which files to create/modify, which patterns to follow, which existing code to reference?
- **Does the implementer get the WHOLE plan or just its subtask?** If the architect decomposes into 5 subtasks, does each implementer see the full picture or only its slice?

### Gap 3: Worktree Docker Build Context

**Status**: Resolved in design — worktrees in sibling directory

Git worktrees share the `.git` directory with the main checkout, which creates Docker build context issues. The solution is placing worktrees outside the repo clone in a sibling directory (`/workspace/worktrees/` alongside `/workspace/repo/`). Each worktree is a standalone directory with its own complete source tree — Docker builds use the worktree path as the build context directly.

Remaining detail to work out during implementation:
- `.dockerignore` needs to be present in the worktree (it will be, since it's part of the repo)
- Build commands in the Taskfile need to accept a `WORKTREE_PATH` variable to point at the correct source directory

### Gap 4: Seed Data and Database Bootstrapping

**Status**: Will tackle during implementation — situational per project

Each sandbox namespace gets a fresh PostgreSQL, but the bootstrapping is project-specific:
- How does the database get seeded? Run migrations from the worktree? Load fixture data?
- If the task includes a new migration, the sandbox DB needs to run it
- Keycloak in each namespace needs realm, clients, and test users configured — non-trivial setup time

This will be solved project-by-project. The Helm chart for the sandbox environment will need init containers or Jobs that handle bootstrapping.

### Gap 5: Full-Stack Helm Chart

**Status**: Needs to be built

The `env:create` task references a unified `./charts/full-stack` chart that deploys the entire application stack into a single namespace. This doesn't exist yet — the current repo has individual charts per service. Creating a parameterized umbrella chart (or Helmfile environment) that composes the individual charts into a single deployable unit is a meaningful piece of work.

### Gap 6: Notifications and Human Communication

**Status**: Later phase — after core system is working

The dashboard exists, but there's no push notification mechanism:
- How does the human know a PR is ready for review? (GitHub notification for now)
- How does the human know a task failed and needs escalation?
- Integration with Slack/Discord for alerts and status updates

For now, GitHub notifications from PR creation and the dashboard are sufficient. Slack integration is a Phase 4+ item.

### Gap 7: Testing the Orchestrator Itself

**Status**: Later phase — manual testing first

How do you test the orchestrator without burning Claude Code tokens? How do you dry-run a task through the pipeline? How do you mock the Claude Code SDK for development?

This will be addressed organically — manual testing first, then add orchestrator-specific tests as patterns emerge. The provider abstraction already makes it possible to create a `MockProvider` that returns canned responses for development.

### Gap 8: Cluster Resource Sizing

**Status**: Not worried for now — will increase if needed

Running 4 concurrent agents means 4 full application stacks. On a `t3.large` (8GB RAM), this could be tight. Will scale up the instance type if it becomes a bottleneck. Sandbox environments should use minimal resource requests/limits compared to production.
