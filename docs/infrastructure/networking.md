# Networking

## Traefik ingress

Traefik handles all HTTP routing into the cluster. Every ingress uses `ingressClassName: traefik` explicitly.

## Service hostnames

Every service gets a subdomain under `DEV_HOSTNAME`. This is set in `.env` to your Tailscale machine name — there is no localhost fallback.

| Service | Hostname |
|---------|----------|
| THE Dev Team chat UI | `devteam.{DEV_HOSTNAME}` |
| THE Dev Team API | `agent-api.{DEV_HOSTNAME}` |
| Application frontend | `app.{DEV_HOSTNAME}` |
| Application API | `api.{DEV_HOSTNAME}` |
| Keycloak | `auth.{DEV_HOSTNAME}` |
| Sandbox frontend | `app.env-{name}.{DEV_HOSTNAME}` |
| Sandbox API | `api.env-{name}.{DEV_HOSTNAME}` |

## How access works (local dev)

A Tailscale gateway pod runs inside minikube and joins your tailnet as an independent device. It has its own Tailscale IP and forwards HTTP traffic to Traefik.

```
Browser → http://devteam.shawns-macbook-pro
       → Tailscale Split DNS resolves to gateway IP (100.106.115.13)
       → Tailscale routes to the gateway pod in minikube
       → iptables forwards port 80 to Traefik's ClusterIP
       → Traefik routes by Host header to the correct service
```

This works from any device on your tailnet — laptop, phone, another computer. No `/etc/hosts` entries or tunnels needed.

## Tailscale gateway

The gateway pod (`infrastructure/k8s/charts/tailscale-gateway/`) runs two containers:

1. **Tailscale** — joins your tailnet, sets up iptables rules to forward ports 80/443 to Traefik
2. **CoreDNS** — resolves `*.{DEV_HOSTNAME}` to the gateway's Tailscale IP

The gateway is only deployed when `TS_AUTHKEY` is set in `.env` (local dev only — remote servers manage their own Tailscale and DNS).

### Split DNS

Tailscale Split DNS is configured in the [admin console](https://login.tailscale.com/admin/dns) to route all `{DEV_HOSTNAME}` domain queries to the gateway's CoreDNS sidecar. This means every tailnet device automatically resolves any hostname under `*.{DEV_HOSTNAME}` — including dynamically created sandbox hostnames.

## The `DEV_HOSTNAME` variable

`DEV_HOSTNAME` must be set to your Tailscale machine name. Find it with:

```bash
task tailscale:hostname
```

Helmfile reads `DEV_HOSTNAME` and templates it into every ingress resource. It is a required variable — deploys fail fast if it's missing.

## Remote servers

Remote servers (EC2, dedicated hosts, etc.) have their own Tailscale node and DNS. The gateway pod is not deployed on remote servers. Each server manages its own Split DNS entry in the Tailscale admin console.

## Related reading

- [Tailscale Setup](tailscale-setup.md)
- [Kubernetes](kubernetes.md)
- [Sandbox Environments](../the-dev-team/sandbox-environments.md)
- [Environment Setup](../getting-started/environment-setup.md)
