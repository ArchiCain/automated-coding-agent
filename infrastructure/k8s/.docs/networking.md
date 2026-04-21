# Networking

## Traefik ingress

Traefik handles all HTTP routing into the cluster. Every ingress uses `ingressClassName: traefik` explicitly. The tunnel (`task tunnel`) port-forwards Traefik to `0.0.0.0:8080`, and a pfctl redirect maps port 80 to 8080 so URLs don't need a port.

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

## How access works

```
Browser -> http://devteam.shawns-macbook-pro
       -> macOS resolver checks /etc/resolver/shawns-macbook-pro
       -> dnsmasq resolves *.shawns-macbook-pro to 127.0.0.1
       -> pfctl redirects port 80 -> 8080
       -> kubectl port-forward on 0.0.0.0:8080 picks it up
       -> Traefik routes by Host header to the correct service
```

This works for all hostnames under `*.{DEV_HOSTNAME}` — including dynamically created sandbox hostnames. No manual DNS entries needed.

## dnsmasq

`task tunnel` (called automatically by `task up`) configures dnsmasq:

1. Writes `address=/{DEV_HOSTNAME}/127.0.0.1` to `/opt/homebrew/etc/dnsmasq.d/{DEV_HOSTNAME}.conf`
2. Starts dnsmasq via `brew services`
3. Creates `/etc/resolver/{DEV_HOSTNAME}` pointing at `127.0.0.1`

After this, any `*.{DEV_HOSTNAME}` query resolves to `127.0.0.1`. This is a one-time setup — dnsmasq persists across reboots via launchd.

The tunnel runs in a tmux session (`tmux attach -t tunnel` to view). `task close` kills it.

## The `DEV_HOSTNAME` variable

`DEV_HOSTNAME` must be set to your Tailscale machine name. Find it with:

```bash
task tailscale:hostname
```

Helmfile reads `DEV_HOSTNAME` and templates it into every ingress resource. It is a required variable — deploys fail fast if it's missing.
