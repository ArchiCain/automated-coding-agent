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
CLAUDE_CODE_OAUTH_TOKEN=...          # claude setup-token (requires Max plan)

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

## Start everything

```bash
task up
```

This single command:

1. Starts Minikube (4 CPU, 8 GB RAM, 50 GB disk)
2. Creates K8s secrets from `.env`
3. Builds all Docker images into the cluster
4. Deploys everything via Helmfile
5. Adds `/etc/hosts` entries (prompts for sudo once, skips if already set)
6. Starts a Traefik tunnel in a tmux session

On completion you'll see:

```
============================================
  THE Dev Team:
    Chat UI:  http://devteam.shawns-macbook-pro:8080
    API:      http://agent-api.shawns-macbook-pro:8080
  Application:
    Frontend: http://app.shawns-macbook-pro:8080
    API:      http://api.shawns-macbook-pro:8080
    Auth:     http://auth.shawns-macbook-pro:8080
============================================
  Tunnel running in tmux session 'tunnel'.
  tmux attach -t tunnel   to view
  task close              to stop
```

## Day-to-day commands

```bash
task tunnel       # restart tunnel after reboot or pod restart
task close        # stop the tunnel
task status       # check what's running
task reset:up     # nuclear option: wipe K8s state + redeploy
```

The tunnel runs in a tmux session called `tunnel`. You can attach to it with `tmux attach -t tunnel` to see connection logs, and detach with `Ctrl-b d`.

## Changing machines

If you move to a new machine or your Tailscale node changes:

```bash
# Update .env
DEV_HOSTNAME=new-machine-name
TAILSCALE_IP=100.x.x.x

# Redeploy ingresses and CoreDNS
task deploy:apply

# Restart the tunnel
task tunnel
```
