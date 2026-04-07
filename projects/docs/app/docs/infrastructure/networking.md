# Networking

## Traefik ingress

Traefik handles all HTTP routing into the cluster. It's installed via Helm (not K3s's bundled version) so it can be managed alongside the other releases. On Minikube, the nginx-ingress addon fills the same role.

## Service hostnames

Every service gets a subdomain under a single base hostname. The base hostname is controlled by the `DEV_HOSTNAME` environment variable, which lets the same URLs work on localhost, on a Tailscale machine, and on production.

| Service | Pattern |
|---------|---------|
| Application frontend | `app.{DEV_HOSTNAME}` |
| Application API | `api.{DEV_HOSTNAME}` |
| Keycloak | `auth.{DEV_HOSTNAME}` |
| Docs | `docs.{DEV_HOSTNAME}` |
| THE Dev Team orchestrator | `the-dev-team.{DEV_HOSTNAME}` |
| THE Dev Team dashboard | `dashboard.the-dev-team.{DEV_HOSTNAME}` |
| Per-task sandbox frontend | `app.{task-id}.{DEV_HOSTNAME}` |
| Per-task sandbox API | `api.{task-id}.{DEV_HOSTNAME}` |
| Per-task sandbox Keycloak | `auth.{task-id}.{DEV_HOSTNAME}` |

## The `DEV_HOSTNAME` variable

`DEV_HOSTNAME` defaults to `localhost` — use it unchanged if you're only developing on the machine that runs the cluster.

Override it when you want to reach local services from **another device** — typically another machine on your tailnet. The value should be something every device in your network can resolve to the host running Minikube (or K3s).

### Example: `DEV_HOSTNAME` unset vs set

| Service | `DEV_HOSTNAME=localhost` (default) | `DEV_HOSTNAME=shawns-macbook` (Tailscale) |
|---------|------------------------------------|-------------------------------------------|
| Application frontend | `http://app.localhost` | `http://app.shawns-macbook` |
| Application API | `http://api.localhost` | `http://api.shawns-macbook` |
| THE Dev Team dashboard | `http://dashboard.the-dev-team.localhost` | `http://dashboard.the-dev-team.shawns-macbook` |
| Sandbox for task `abc123` | `http://app.abc123.localhost` | `http://app.abc123.shawns-macbook` |

Whichever value you pick, set it once in `.env`:

```bash
DEV_HOSTNAME=shawns-macbook
```

Helmfile reads `DEV_HOSTNAME` and templates it into every ingress resource. Restart the stack (`task deploy:apply`) after changing it.

## Detecting your Tailscale hostname

If you want the Tailscale pattern, you need to know your tailnet machine name. The repo ships a helper task:

```bash
task tailscale:hostname
# → shawns-macbook
```

This queries the Tailscale CLI for the current machine's tailnet name. Export it into `.env`:

```bash
DEV_HOSTNAME=$(task tailscale:hostname) task deploy:apply
```

Or simply:

```bash
echo "DEV_HOSTNAME=$(task tailscale:hostname)" >> .env
```

## Tailscale for local dev

Tailscale's main role is **secure networking between devices**. A common setup:

- Minikube (or Docker Desktop) runs on your Mac Mini
- You develop from a MacBook sitting in a different room
- Both machines are on the same tailnet
- Set `DEV_HOSTNAME=mac-mini` (or whatever Tailscale names the Mac Mini)
- From the MacBook, you can now hit `http://app.mac-mini`, `http://dashboard.the-dev-team.mac-mini`, and every `env-*` sandbox without port-forwarding or VPNs

The same pattern applies to deploying to a remote K3s node: change `DEV_HOSTNAME` to the node's tailnet name and Helmfile does the rest.

## Tailscale for production + CI

Tailscale also provides the production networking fabric:

- Every deployment target (Mac Mini, EC2, Raspberry Pi) joins the tailnet
- GitHub Actions runners join ephemerally as `tag:ci` to build, push images, and run `helmfile apply` against private infrastructure
- No exposed ports, no bastion hosts

### Current tailnet devices (example)

| Device | Role |
|--------|------|
| mac-mini | K3s server, container registry |
| shawns-macbook-pro | Development machine |

### GitHub Actions integration

CI runners join the tailnet as ephemeral nodes:

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

Tailscale MagicDNS resolves device names (`mac-mini`) but not subdomains (`app.mac-mini`, `dashboard.the-dev-team.mac-mini`). To make service hostnames work on all tailnet devices:

1. A CoreDNS pod runs in the cluster (deployed by Helmfile's `dns` release)
2. It resolves any `*.{DEV_HOSTNAME}` query to the host's Tailscale IP
3. Tailscale Split DNS routes all `{DEV_HOSTNAME}` domain queries to this CoreDNS instance

### Setup (one-time per host)

Go to [Tailscale DNS settings](https://login.tailscale.com/admin/dns):

1. Add nameserver > Custom
2. Enter the host's Tailscale IP (e.g., `100.71.239.27`)
3. Check "Restrict to domain"
4. Enter the domain matching `DEV_HOSTNAME` (e.g., `mac-mini` or `shawns-macbook`)
5. Save

### Adding a new deployment target

For a new K3s node with domain `prod`:

1. Set `DEV_HOSTNAME=prod` (and `TAILSCALE_IP`) in the target's `.env`
2. Helmfile deploys CoreDNS with the correct config automatically
3. Add another Split DNS entry in Tailscale for the new domain

### Rotating OAuth credentials

1. Revoke the old credential at [Trust Credentials](https://login.tailscale.com/admin/settings/trust-credentials)
2. Create a new one with the same settings
3. Update `TS_OAUTH_CLIENT_ID` and `TS_OAUTH_SECRET` in GitHub repo secrets

## Related reading

- [Kubernetes](kubernetes.md)
- [Sandbox Environments](../the-dev-team/sandbox-environments.md)
- [Environment Setup](../getting-started/environment-setup.md)
