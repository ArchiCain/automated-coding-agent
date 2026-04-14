# Networking

## Traefik ingress

Traefik handles all HTTP routing into the cluster. Every ingress uses `ingressClassName: traefik` explicitly. The tunnel (`task tunnel`) port-forwards Traefik to `0.0.0.0:8080`, making all services accessible via hostname on port 8080.

## Service hostnames

Every service gets a subdomain under `DEV_HOSTNAME`. This is set in `.env` to your Tailscale machine name — there is no localhost fallback.

| Service | Hostname |
|---------|----------|
| THE Dev Team chat UI | `devteam.{DEV_HOSTNAME}` |
| THE Dev Team API | `agent-api.{DEV_HOSTNAME}` |
| Application frontend | `app.{DEV_HOSTNAME}` |
| Application API | `api.{DEV_HOSTNAME}` |
| Keycloak | `auth.{DEV_HOSTNAME}` |
| Sandbox frontend | `app.{task-id}.{DEV_HOSTNAME}` |
| Sandbox API | `api.{task-id}.{DEV_HOSTNAME}` |

## How access works

```
Browser → http://devteam.shawns-macbook-pro:8080
       → /etc/hosts resolves to Tailscale IP (100.64.158.57)
       → kubectl port-forward on 0.0.0.0:8080 picks it up
       → Traefik routes by Host header to the-dev-team-frontend service
       → nginx in the frontend container proxies /api/ to the backend
```

The tunnel runs in a tmux session (`tmux attach -t tunnel` to view). `task close` kills it.

## /etc/hosts

`task tunnel` (called automatically by `task up`) adds entries to `/etc/hosts` on first run:

```
100.64.158.57 devteam.shawns-macbook-pro agent-api.shawns-macbook-pro app.shawns-macbook-pro api.shawns-macbook-pro auth.shawns-macbook-pro
```

This requires sudo — the developer is prompted for their password once. On subsequent runs, the task detects existing entries and skips.

## Tailscale Split DNS (multi-device access)

The `/etc/hosts` entries only work on the machine running Minikube. To access services from other tailnet devices (phone, another laptop), configure Tailscale Split DNS:

### In-cluster CoreDNS

A CoreDNS pod runs in the `dns` namespace (deployed by Helmfile). It resolves any `*.{DEV_HOSTNAME}` query to the Tailscale IP configured in `.env`:

```
*.shawns-macbook-pro → 100.64.158.57
```

### Setup (one-time)

1. Advertise the minikube subnet so other tailnet devices can reach the CoreDNS:
   ```bash
   tailscale up --advertise-routes=$(minikube ip)/24
   ```
2. Approve the route in [Tailscale admin console](https://login.tailscale.com/admin/machines) → your machine → Edit route settings
3. Add a nameserver in [Tailscale DNS settings](https://login.tailscale.com/admin/dns):
   - Type: Custom
   - Nameserver IP: `$(minikube ip)` (e.g. `192.168.49.2`)
   - Restrict to domain: `{DEV_HOSTNAME}` (e.g. `shawns-macbook-pro`)

After this, all tailnet devices resolve `*.shawns-macbook-pro` via the in-cluster CoreDNS. No `/etc/hosts` needed on any device.

## The `DEV_HOSTNAME` variable

`DEV_HOSTNAME` must be set to your Tailscale machine name. Find it with:

```bash
task tailscale:hostname
```

Helmfile reads `DEV_HOSTNAME` and templates it into every ingress resource. After changing it:

```bash
task deploy:apply    # Update ingresses and CoreDNS
task tunnel          # Restart the tunnel
```

## Related reading

- [Kubernetes](kubernetes.md)
- [Sandbox Environments](../the-dev-team/sandbox-environments.md)
- [Environment Setup](../getting-started/environment-setup.md)
