# Environment Setup

## Create your .env file

Copy the template and fill in your values:

```bash
cp .env.template .env
```

The `.env` file is the single source of truth for all configuration. It is gitignored and never committed.

## First-time K8s secret setup

After creating your `.env` file, run:

```bash
task setup-secrets
```

This creates the necessary K8s secrets from your `.env` values. You only need to run this once (or again if you change secret values).

## .env structure

The file is organised into sections.

### Hostname configuration

```bash
DEV_HOSTNAME=localhost
```

`DEV_HOSTNAME` drives every ingress URL in the cluster. The defaults work out of the box on a single machine, but you'll override it if you want to reach local services from other devices.

- **Default (`localhost`)** — app at `app.localhost`, dashboard at `dashboard.localhost`, orchestrator at `agent-api.localhost`
- **Tailscale machine name** — set this to your tailnet hostname (e.g. `shawns-macbook`) to reach the same services from any device on your tailnet

See [Tailscale hostname use case](#tailscale-hostname-use-case) below and [Networking](../infrastructure/networking.md) for the full explanation.

### Ingress hosts

These override the default ingress hostnames if needed. With `DEV_HOSTNAME` set correctly, you rarely need to change them:

```bash
DASHBOARD_HOST=dashboard.localhost
CODING_AGENT_BACKEND_HOST=agent-api.localhost
BACKEND_HOST=api.localhost
FRONTEND_HOST=app.localhost
KEYCLOAK_HOST=auth.localhost
DOCS_HOST=docs.localhost
```

### Database

```bash
DATABASE_HOST=database               # K8s service name
DATABASE_HOST_LOCAL=localhost        # For running tests on the host
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=postgres           # Change for production
DATABASE_NAME=postgres
DATABASE_SSL=false
```

### Keycloak

```bash
KEYCLOAK_REALM=application
KEYCLOAK_CLIENT_ID=backend-service
KEYCLOAK_CLIENT_SECRET=backend-service-secret
KEYCLOAK_ADMIN_PASSWORD=admin
```

### API keys

```bash
ANTHROPIC_API_KEY=             # Required for THE Dev Team (Claude Code provider)
OPENAI_API_KEY=                # Optional
GOOGLE_GENERATIVE_AI_API_KEY=  # Optional
```

### THE Dev Team

```bash
CLAUDE_CODE_OAUTH_TOKEN=       # From `claude setup-token` (Max plan)
GITHUB_TOKEN=                  # Fine-grained PAT — read-only issues, write PRs
                               # Scoped to this repo only; used by the bot account

# GitHub App credentials (for installation-based auth)
GITHUB_APP_ID=
GITHUB_APP_CLIENT_ID=
GITHUB_APP_INSTALLATION_ID=

# Optional overrides (default to values in the-dev-team.config.yml):
ISSUE_POLL_CRON=               # e.g. "*/5 * * * *"
REVIEW_POLL_CRON=              # e.g. "*/2 * * * *"
EXECUTION_MODE=sandbox         # sandbox (default) or local
```

See [THE Dev Team Configuration](../the-dev-team/configuration.md) for the role-to-provider mapping, which lives in `.the-dev-team/config/the-dev-team.config.yml` rather than env vars.

### K8s deployment

These are only needed when deploying to a cluster. See [Kubernetes](../infrastructure/kubernetes.md) for details.

```bash
DEPLOY_ENV=local                 # local | mac-mini | prod
NAMESPACE=app
REGISTRY=localhost:30500
```

## Deploy flow

The deploy flow is entirely K8s-based:

```bash
task setup-secrets     # First time: create K8s secrets from .env
task up                # Start Minikube + build + deploy everything
task minikube:tunnel   # Separate terminal: enable ingress access
```

This gives you the same topology locally (Minikube) as in production (K3s). See [Local Workflow](../development/local-workflow.md) for the full workflow.

## Tailscale hostname use case

If you want to access local services from other devices on your tailnet (phone, another laptop, another machine running E2E tests), set `DEV_HOSTNAME` to your Tailscale machine name:

```bash
# In .env
DEV_HOSTNAME=shawns-macbook
```

The repo ships a helper task that detects your tailnet hostname automatically:

```bash
task tailscale:hostname
# -> shawns-macbook
```

You can pipe it directly into `.env`:

```bash
echo "DEV_HOSTNAME=$(task tailscale:hostname)" >> .env
```

After changing `DEV_HOSTNAME`, re-deploy so the ingress resources pick it up:

```bash
task deploy:apply
```

Once that's done, every service — main stack, orchestrator, dashboard, and every agent sandbox — is reachable at the Tailscale pattern from any device on your tailnet:

| Service | URL |
|---------|-----|
| Application frontend | `http://app.shawns-macbook` |
| Dashboard | `http://dashboard.shawns-macbook` |
| Orchestrator API | `http://agent-api.shawns-macbook` |
| Sandbox for task `abc123` | `http://app.abc123.shawns-macbook` |

See [Networking](../infrastructure/networking.md#the-dev_hostname-variable) for the full table.

You'll also need a one-time Tailscale Split DNS entry so `*.shawns-macbook` resolves across the tailnet. See [Networking -> Split DNS](../infrastructure/networking.md#split-dns).

## direnv integration

The `.envrc` file contains `use flake`, which tells direnv to activate the Nix dev shell. The root `Taskfile.yml` loads `.env` via its `dotenv` directive, so all task commands automatically have access to environment variables.

## No-defaults policy

Application code must never provide fallback defaults for environment variables:

```typescript
// Bad — hides misconfiguration
const host = process.env.DATABASE_HOST || "localhost";

// Good — fails fast if not set
const host = process.env.DATABASE_HOST;
if (!host) throw new Error('DATABASE_HOST must be set in .env');
```

Defaults belong in `.env.template` and Helm values, not in application code.
