# Configuration

THE Dev Team's runtime behaviour is driven by a single YAML file: `.the-dev-team/config/the-dev-team.config.yml`. This is the file you edit to change concurrency, retry budgets, provider assignments per role, and model selection.

The file is loaded once at orchestrator startup by `DevTeamConfigService` and validated against a Zod schema. Malformed config is a hard error — the orchestrator refuses to start.

## Full example

```yaml
# .the-dev-team/config/the-dev-team.config.yml

# How many tasks can run concurrently.
# Each concurrent task needs its own full-stack sandbox, so this is
# mostly bounded by cluster resources.
maxConcurrent: 4

# How many retries a single gate (or reviewer iteration) gets before
# the task is escalated to a human.
retryBudget: 3

# If true, the sandbox namespace is kept alive after the task completes
# so a human reviewer can poke at it. The stale-environment reaper will
# destroy it after 24 hours regardless.
keepEnvironmentForReview: true

# Execution mode: "sandbox" (default) deploys a full K8s namespace per task.
# Override via EXECUTION_MODE env var in K8s.
executionMode: sandbox

# How often to poll GitHub for new issues labelled `the-dev-team`.
issuePollCron: "*/5 * * * *"

# How often to check open PRs for new review comments.
reviewPollCron: "*/2 * * * *"

# The default provider + model for any role that doesn't override it.
default:
  provider: claude-code
  model: claude-sonnet-4

# Per-role overrides.
roles:
  architect:
    provider: claude-code
    model: claude-opus-4-6          # Needs strong reasoning
  implementer:
    provider: claude-code
    model: claude-sonnet-4          # Cost/quality balance
  reviewer:
    provider: claude-code
    model: claude-opus-4-6
  tester:
    provider: claude-code
    model: claude-sonnet-4
  designer:
    provider: claude-code
    model: claude-opus-4-6          # Requires vision
  bugfixer:
    provider: claude-code
    model: claude-sonnet-4
  documentarian:
    provider: claude-code
    model: claude-sonnet-4
  monitor:
    provider: claude-code
    model: claude-sonnet-4
  devops:
    provider: claude-code
    model: claude-sonnet-4
```

## Schema

```typescript
interface DevTeamConfig {
  maxConcurrent: number;              // default: 4
  retryBudget: number;                // default: 3
  keepEnvironmentForReview: boolean;  // default: true
  executionMode: 'sandbox' | 'local'; // default: sandbox
  issuePollCron: string;              // default: "*/5 * * * *"
  reviewPollCron: string;             // default: "*/2 * * * *"
  default: ProviderConfig;            // required
  roles: Partial<Record<TaskRole, ProviderConfig>>;
}

interface ProviderConfig {
  provider: 'claude-code' | 'opencode';
  model: string;
  apiKeyEnv?: string;                 // Override env var for credentials
  temperature?: number;
  maxTokens?: number;
}

type TaskRole =
  | 'architect'
  | 'implementer'
  | 'reviewer'
  | 'tester'
  | 'designer'
  | 'bugfixer'
  | 'documentarian'
  | 'monitor'
  | 'devops';
```

## Concurrency: `maxConcurrent`

Controls the size of the `AgentPoolService` slot array. Each slot runs one task at a time. With `maxConcurrent: 4`, up to 4 tasks execute in parallel — each with its own worktree and its own `env-{task-id}` namespace.

Practical limits:

- Each sandbox is ~1 CPU and ~1.5 GB of memory at minimum resources
- 4 concurrent sandboxes plus the main `app` namespace plus the orchestrator comfortably fit on a machine with 8 GB RAM and 6 cores
- On a smaller dev laptop, start with `maxConcurrent: 2`

The orchestrator also checks cluster capacity before assigning — if the nodes are above 80% CPU or memory, new task assignment is paused even if slots are free.

## Execution mode: `executionMode`

Defaults to `sandbox`. In sandbox mode, every task gets a dedicated `env-{task-id}` K8s namespace with a full application stack.

In K8s deployments, the `EXECUTION_MODE` environment variable overrides the config file value. The Helmfile configuration sets `EXECUTION_MODE: sandbox` by default. See [Sandbox Environments](sandbox-environments.md) for the full lifecycle.

## Retry budget: `retryBudget`

The number of retries allowed per gate **and** per reviewer loop iteration. With `retryBudget: 3`:

- A gate can fail and be retried up to 3 times (4 total attempts with bugfixer in between)
- The reviewer loop in Phase 5 can run up to 3 times before escalating

Setting this too low causes avoidable escalations. Setting it too high burns tokens on unfixable problems. Three is the default; raise to 5 for brittle test suites, lower to 2 if you want fast human triage.

## Provider mapping

Every role resolves to a `ProviderConfig` at dispatch time:

```typescript
getProviderConfig(role: TaskRole): ProviderConfig {
  return this.config.roles[role] ?? this.config.default;
}
```

This is how you route specific roles to specific models:

- Heavy reasoning (architect, reviewer) -> a stronger model
- Grinder roles (implementer, tester, bugfixer) -> a faster/cheaper model
- Vision-requiring roles (designer) -> a vision-capable model — this is enforced at startup (config validation fails if you assign a non-vision model to `designer`)

### Switching providers per role

```yaml
roles:
  architect:
    provider: claude-code
    model: claude-opus-4-6
  implementer:
    provider: opencode                  # Different provider!
    model: some-open-model
    apiKeyEnv: OPENCODE_API_KEY
```

The `opencode` provider is a stub in Phase 1 — all it does today is throw "not implemented". It exists so the abstraction is proven to hold. When a real OpenCode integration lands, only this stub changes; roles don't need to know.

## Why a YAML file and not env vars

- **Role-keyed config is hierarchical** — mapping nine roles to nine provider configs via env vars would require 30+ variables and be fragile
- **Edit-in-place** — someone debugging a task can tweak the config and restart the orchestrator without touching a K8s Secret
- **Git-trackable** — the file is committed alongside the code, so provider mappings evolve with the rest of the system

Credentials stay in environment variables (injected from the `the-dev-team-agent-secrets` K8s Secret — see [Safety Model](safety-model.md#layer-7--secret-isolation)). The config file only names **which** credential to use, never the credential itself.

## How to override providers per role

Four steps:

1. Edit `.the-dev-team/config/the-dev-team.config.yml`
2. Add or change an entry under `roles:` for the role you want to change
3. If you're switching to a provider that needs a new credential, add the env var to `the-dev-team-agent-secrets`
4. Restart the orchestrator: `kubectl rollout restart deployment/coding-agent-backend -n coding-agent`

The change takes effect for the next role dispatch. Tasks already running finish under the old config.

## GitHub App secret setup

The orchestrator authenticates with GitHub via a GitHub App installation. The private key is stored as a K8s secret:

1. Create a GitHub App with the required permissions (issues read, PRs write, contents write)
2. Generate a private key and download the `.pem` file
3. Set the following in your `.env`:
   ```bash
   GITHUB_APP_ID=your-app-id
   GITHUB_APP_CLIENT_ID=your-client-id
   GITHUB_APP_INSTALLATION_ID=your-installation-id
   ```
4. Run `task setup-secrets` to create the K8s secret from the `.pem` file and env vars

The `setup-secrets` script reads the private key from `.github-app-private-key.pem` at the repo root (gitignored) and creates the appropriate K8s secret in the `coding-agent` namespace.

## Environment variables

A small number of things live in env vars rather than the YAML file, because they are environment-specific (per machine, per cluster):

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Credentials for the claude-code provider |
| `CLAUDE_CODE_OAUTH_TOKEN` | OAuth token for Claude Code (Max plan) |
| `GITHUB_TOKEN` | Bot account PAT |
| `GITHUB_APP_ID` | GitHub App ID |
| `GITHUB_APP_CLIENT_ID` | GitHub App client ID |
| `GITHUB_APP_INSTALLATION_ID` | GitHub App installation ID |
| `DEV_HOSTNAME` | Hostname suffix for ingress (see [Networking](../infrastructure/networking.md)) |
| `REPO_ROOT` | Absolute path to the repo checkout inside the pod |
| `EXECUTION_MODE` | Overrides `executionMode` from config file (default: `sandbox`) |
| `ISSUE_POLL_CRON` | Overrides the YAML cron if set |
| `REVIEW_POLL_CRON` | Overrides the YAML cron if set |

See [Environment Setup](../getting-started/environment-setup.md) for the full `.env` template.

## Related reading

- [Orchestrator](../projects/coding-agent/backend.md)
- [Execution Loop](execution-loop.md)
- [Safety Model](safety-model.md)
- [Roles & Skills](roles-and-skills.md)
