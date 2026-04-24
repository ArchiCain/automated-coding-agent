# Environment Configuration

Environment variable patterns and secrets handling across compose stacks.

## Where values live

Each compose project carries its own `.env` file alongside its
`compose.yml`. These files are **not** checked in; templates with
placeholders are.

| Compose project | Tracked template | Live `.env` (on host-machine) |
|---|---|---|
| `dev` | `infrastructure/compose/dev/.env.template` | `/srv/aca/infrastructure/compose/dev/.env` |
| `openclaw` | `infrastructure/compose/openclaw/.env.template` | `/srv/aca/infrastructure/compose/openclaw/.env` |

The host's `.env` files are placed once during
[host bootstrap](../../infrastructure/.docs/ecosystem.md) and stay put
between deploys. `scripts/deploy.sh` rsyncs the compose `.yml` files
but deliberately does **not** touch `.env`.

There is no top-level `.env` consumed by anything that deploys. (A
root-level `.env` may exist on the dev laptop for ad-hoc tasks, but it
is not part of the deploy model.)

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
