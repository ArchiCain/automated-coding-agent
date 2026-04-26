# Environment Configuration

Environment variable patterns and secrets handling across compose stacks.

## Where values live

The deploy workflow reads from one place — the **root `.env`** on the
developer's laptop — and pushes everything to GH secrets/variables via
`task gh:setup`. On every deploy, the workflow renders the openclaw
compose `.env` from those secrets and rsyncs it to the host along with
the GitHub App PEM.

| File | Source of truth | What's in it |
|---|---|---|
| Root `.env` | Developer's laptop (gitignored) | Every value the deploy workflow needs (8 required + 2 optional). Validated by `scripts/env-check.sh`. |
| `/srv/aca/infrastructure/compose/openclaw/.env` (on host) | Rendered by CI from GH secrets | Anthropic/OpenAI keys, gateway pairing token, GitHub App IDs, PEM path, GIT_REPO_URL, DOCKER_SOCKET_GID |
| `/srv/aca/secrets/github-app.pem` (on host) | Rendered by CI from GH secret | The App's private key |

The dev compose stack reads no env at runtime — postgres credentials,
the database name, and the Keycloak client secret are baked into
`infrastructure/compose/dev/compose.yml` as literals (the same model
that `infrastructure/compose/sandbox/compose.yml` uses). So there's no
`dev/.env` to render or place.

## No-defaults policy

**NEVER provide default values for environment variables in application
code.**

### Rationale

Default values hide configuration errors and lead to:

- **Silent failures** — apps running with incorrect configuration
- **Security risks** — services connecting to the wrong database or
  using incorrect credentials
- **Hard-to-debug issues** — problems that only manifest in specific
  environments
- **Configuration drift** — different behavior between environments due
  to hidden defaults

### Implementation

**❌ Don't:**
```typescript
const host = process.env.DATABASE_HOST || "localhost";
const apiUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8080";
```

**✅ Do:**
```typescript
const host = process.env.DATABASE_HOST;
if (!host) {
  throw new Error('DATABASE_HOST must be set in .env');
}
```

All services validate required env vars at startup, throw clear errors
listing what's missing, and reference the `.env.template` to guide the
operator.

## CI secrets

GitHub Actions-side configuration (separate from the host's `.env`):

| Scope | Name | Purpose |
|---|---|---|
| Secret | `TAILSCALE_OAUTH_CLIENT_ID` | Join the tailnet as `tag:ci` |
| Secret | `TAILSCALE_OAUTH_SECRET` | Join the tailnet as `tag:ci` |
| Secret | `GITHUB_TOKEN` | Push images to GHCR (auto-provided by Actions) |
| Variable | `DEPLOY_HOST` | Tailscale hostname of host-machine |

No Terraform outputs, no cloud secret manager. All host-side values
live in the per-compose-project `.env` files on host-machine.

## Related

- [Task Automation](task-automation.md)
- [Compose stacks](../../infrastructure/compose/.docs/overview.md)
- [Ecosystem](../../infrastructure/.docs/ecosystem.md)
