# Networking

## Traefik ingress

Traefik handles all HTTP routing into the cluster. It's installed via Helm (not K3s's bundled version) to manage it alongside other releases.

### Service hostnames

Each service gets a subdomain:

| Service | Local | K8s (Mac Mini) |
|---------|-------|-----------------|
| Frontend | http://localhost:3000 | http://app.mac-mini |
| Backend API | http://localhost:8085 | http://api.mac-mini |
| Keycloak | http://localhost:8081 | http://auth.mac-mini |
| Docs | http://localhost:8083 | http://docs.mac-mini |
| Coding Agent Frontend | http://localhost:3001 | http://agent.mac-mini |
| Coding Agent API | http://localhost:8086 | http://agent-api.mac-mini |

Hostnames are configured via env vars (`BACKEND_HOST`, `FRONTEND_HOST`, etc.).

## Tailscale

Tailscale provides secure networking between all devices (MacBook, Mac Mini, EC2 instances) and enables GitHub Actions to deploy to private infrastructure without exposing ports.

### Current tailnet devices

| Device | Role |
|--------|------|
| mac-mini | K3s server, container registry |
| shawns-macbook-pro | Development machine |

### GitHub Actions integration

CI runners join the tailnet as ephemeral nodes to build, push images, and deploy:

1. The `tailscale/github-action@v3` step installs Tailscale on the runner
2. Authenticates using OAuth credentials (stored as repo secrets)
3. Joins the tailnet tagged `tag:ci`
4. Runner can reach `mac-mini:30500` (registry) and `mac-mini:6443` (K8s API)
5. Node is automatically removed when the job completes

### Required secrets

| Secret | Description |
|--------|-------------|
| `TS_OAUTH_CLIENT_ID` | Tailscale OAuth client ID |
| `TS_OAUTH_SECRET` | Tailscale OAuth client secret |

Create these at [Tailscale Trust Credentials](https://login.tailscale.com/admin/settings/trust-credentials) with OAuth type, Devices Core Write scope, and `tag:ci`.

## Split DNS

Tailscale MagicDNS resolves device names (`mac-mini`) but not subdomains (`app.mac-mini`). To make service hostnames work on all tailnet devices:

1. A CoreDNS pod runs in the K3s cluster (deployed by Helmfile's `dns` release)
2. It resolves any `*.mac-mini` query to the Mac Mini's Tailscale IP
3. Tailscale Split DNS routes all `mac-mini` domain queries to this CoreDNS instance

### Setup (one-time)

Go to [Tailscale DNS settings](https://login.tailscale.com/admin/dns):

1. Add nameserver > Custom
2. Enter the Mac Mini's Tailscale IP (e.g., `100.71.239.27`)
3. Check "Restrict to domain"
4. Enter domain: `mac-mini`
5. Save

### Adding a new deployment target

For a new K3s node with domain `prod`:

1. Set `TAILSCALE_IP` and `DNS_DOMAIN` in the target's `.env`
2. Helmfile deploys CoreDNS with the correct config automatically
3. Add another Split DNS entry in Tailscale for the new domain

### Rotating OAuth credentials

1. Revoke the old credential at [Trust Credentials](https://login.tailscale.com/admin/settings/trust-credentials)
2. Create a new one with the same settings
3. Update `TS_OAUTH_CLIENT_ID` and `TS_OAUTH_SECRET` in GitHub repo secrets
