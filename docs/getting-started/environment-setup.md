# Environment Setup

## Create your .env file

```bash
cp .env.template .env
```

The `.env` file is the single source of truth for all configuration. It is gitignored and never committed.

## Required values

Fill in these before running anything:

```bash
# Tailscale — required, no localhost fallback
DEV_HOSTNAME=shawns-macbook-pro      # task tailscale:hostname to find yours
TAILSCALE_IP=100.64.158.57           # tailscale ip -4

# Secrets
DATABASE_PASSWORD=<something>
KEYCLOAK_ADMIN_PASSWORD=<something>

# THE Dev Team agent
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat...   # claude setup-token (requires Max plan)
GITHUB_TOKEN=<fine-grained PAT>

# GitHub App (for issue/PR automation)
GITHUB_APP_ID=
GITHUB_APP_CLIENT_ID=
GITHUB_APP_INSTALLATION_ID=
# Place your private key at .github-app-private-key.pem
```

Find your Tailscale values:

```bash
task tailscale:hostname   # → shawns-macbook-pro
tailscale ip -4           # → 100.64.158.57
```

## K8s secrets setup (first time only)

```bash
task setup-secrets
```

Creates the GitHub App private key secret in Kubernetes. Re-run if the key changes.

## Deploy

```bash
task up
```

Starts Minikube, builds all images, deploys via Helmfile, then runs `task tunnel`.

## Accessing services

`task tunnel` port-forwards Traefik to `0.0.0.0:8080` and prints your URLs:

```
http://devteam.shawns-macbook-pro:8080     → THE Dev Team chat UI
http://agent-api.shawns-macbook-pro:8080   → THE Dev Team API
http://app.shawns-macbook-pro:8080         → Application frontend
http://api.shawns-macbook-pro:8080         → Application API
http://auth.shawns-macbook-pro:8080        → Keycloak
```

On first run, `task tunnel` prints a one-liner to add `/etc/hosts` entries — paste it to enable hostname resolution on this machine until Split DNS is configured.

## Split DNS (one-time, replaces /etc/hosts on all devices)

Once configured, every device on your tailnet resolves `*.shawns-macbook-pro` automatically.

```bash
# 1. Expose the minikube subnet to your tailnet
! tailscale up --advertise-routes=192.168.49.0/24

# 2. Approve in Tailscale admin → Machines → this machine → Edit route settings

# 3. Tailscale admin → DNS → Add nameserver:
#      Type: Custom
#      Nameserver: 192.168.49.2
#      Port: 30053
#      Domain: shawns-macbook-pro
```

After this, all tailnet devices resolve `*.shawns-macbook-pro` via the in-cluster CoreDNS, which points to your Tailscale IP. No `/etc/hosts` needed anywhere.

## Changing machines

If you move to a new machine or your Tailscale node changes:

```bash
# Update .env
DEV_HOSTNAME=new-machine-name
TAILSCALE_IP=100.x.x.x

# Redeploy ingresses and CoreDNS
task deploy:apply
```
