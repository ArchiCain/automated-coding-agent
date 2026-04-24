# EC2 reverse proxy — deferred decision

**Status:** Deferred. Decide concretely in migration phase 5 (EC2 readiness).
**Created:** 2026-04-22, during k3s → Docker Compose migration phase 1.

## Context

Locally (macOS + Docker Desktop), each service publishes its own host port and we reach
it as `http://localhost:{port}`. No reverse proxy runs on the dev machine.

On EC2 we need two things the local setup doesn't:

1. **HTTPS.** Browsers warn on plain HTTP; Keycloak's OAuth flows assume HTTPS
   in production.
2. **Clean hostnames per service** — `https://app.{host}`, `https://api.{host}`,
   `https://auth.{host}`, `https://openclaw.{host}`, plus per-sandbox
   `https://app.env-{id}.{host}` etc. Serving these as ports in URLs
   (`https://aca.example.com:3000`) is ugly and breaks OAuth redirect/CORS/cookie
   assumptions.

Those two together mean some process on the EC2 side must:

- terminate TLS on :443,
- route by `Host` header to the right local container port,
- cover both long-lived services and dynamic sandbox services.

## Candidate shapes

### A. AWS ALB with listener rules

- Managed by AWS, terminates TLS via ACM, routes by host header to target
  groups. Each target group points at one EC2 port.
- Pro: no process on the host; cert rotation handled.
- Con: ~$20/month baseline cost. Sandbox provisioning has to call ALB APIs
  (create listener rule, target group, health check) per sandbox. Not trivial
  to plumb into OpenClaw's devops agent.

### B. Caddy (or nginx/Traefik) on the EC2 host  ← recommended starting point

- Caddy binds :443, gets Let's Encrypt certs automatically via HTTP-01 / TLS-ALPN,
  routes by host header to `localhost:{port}`.
- Config is a Caddyfile on disk; sandbox provisioning writes/removes blocks and
  runs `caddy reload` (or uses Caddy's admin API for idempotent updates).
- Pro: simple, cheap, self-contained, good DX. One systemd unit.
- Con: single point of failure on the host; scaling past one EC2 instance means
  revisiting this.

### C. Port-based public URLs + in-container TLS

- Not viable. Every service ships its own certs, cert rotation is per-container,
  OAuth redirect URLs contain explicit ports, sandboxes each need their own
  cert coverage. Rejected.

## Decision (tentative — confirm in phase 5)

**Shape B (Caddy on the EC2 host).** Install Caddy via apt (or static binary)
in the EC2 user-data. Maintain `/etc/caddy/Caddyfile` with host-header →
`localhost:{port}` blocks for the long-lived services. Sandbox bring-up /
tear-down scripts append/remove blocks and call `systemctl reload caddy`.

Keycloak OAuth clients and `FRONTEND_URL` use the `https://*.{host}` form so
local vs. EC2 only differs in the scheme + hostname.

Nothing about this needs to exist locally — local dev stays on plain port URLs.

## Open questions for phase 5

- Caddyfile vs. Caddy JSON admin API for sandbox dynamic updates (JSON API
  avoids reloads but is more complex to template).
- Wildcard Let's Encrypt cert vs. per-hostname — wildcard requires DNS-01
  challenge, which needs DNS provider API credentials. Per-hostname is simpler
  but produces many certs.
- Where sandbox URL allocation lives — Caddy config as source of truth, or
  a separate registry file that generates Caddy config?

## Port allocation (local)

For reference — the port scheme used locally and replicated on EC2 behind Caddy:

| Service | Local URL | EC2 URL (behind Caddy) |
|---------|-----------|------------------------|
| Dev frontend | `http://localhost:3000` | `https://app.{host}` |
| Dev backend | `http://localhost:8080` | `https://api.{host}` |
| Dev Keycloak | `http://localhost:8081` | `https://auth.{host}` |
| OpenClaw gateway | `http://localhost:3001` | `https://openclaw.{host}` |
| Sandbox frontend | `http://localhost:{base}` | `https://app.env-{id}.{host}` |
| Sandbox backend | `http://localhost:{base+1}` | `https://api.env-{id}.{host}` |
| Sandbox Keycloak | `http://localhost:{base+2}` | `https://auth.env-{id}.{host}` |

Sandbox `{base}` allocation scheme is decided in migration phase 4.

## Cert strategy

Phase 5 ships per-hostname HTTP-01 certs — Caddy's default ACME flow.
Requires A records for `app.{DOMAIN}`, `api.{DOMAIN}`, `auth.{DOMAIN}`, and
`openclaw.{DOMAIN}` pointed at the EIP before the first request. On first
hit per hostname, Caddy issues a Let's Encrypt certificate over port 80 and
caches it on disk at `/var/lib/caddy/.local/share/caddy/certificates/`.
Expect a 30–60s delay on the very first hit while the challenge completes.

HTTP-01 scales fine at steady state (five or six hostnames). Once sandbox
proliferation pushes the count higher — or if Let's Encrypt rate limits
become a concern — switching to wildcard DNS-01 is a two-liner in the
Caddyfile, but it requires a DNS provider's API credentials (Route53,
Cloudflare, etc.). That's left as a post-phase-6 optimization.

## Sandbox hooks

The committed Caddyfile ends with:

```
import /etc/caddy/sandbox.d/*.caddy
```

That directive is the plumbing for sandbox deploys on EC2. A future
`scripts/ec2-sandbox-deploy.sh` will:

1. Drop `/etc/caddy/sandbox.d/{id}.caddy` containing a three-host block that
   maps `app.env-{id}.{DOMAIN}`, `api.env-{id}.{DOMAIN}`, and
   `auth.env-{id}.{DOMAIN}` to the sandbox's local port triple (same shape
   as the long-lived service blocks above).
2. `sudo systemctl reload caddy` — Caddy re-reads every `*.caddy` under
   `sandbox.d/` because of the `import` directive. Reload is fast and
   non-disruptive; existing connections aren't dropped.

Destroy is the inverse: `rm /etc/caddy/sandbox.d/{id}.caddy` then
`systemctl reload caddy`.

Phase 5 only commits the `import` directive and this contract; the
sandbox-on-EC2 deploy script itself is deferred.
