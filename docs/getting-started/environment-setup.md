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
4. Deploys everything via Helmfile (including the Tailscale gateway if `TS_AUTHKEY` is set)

## Tailscale gateway setup (first time only)

The Tailscale gateway gives minikube its own tailnet IP so all services are accessible by hostname from any device on your tailnet. No `/etc/hosts` entries needed.

### 1. Generate a Tailscale auth key

Go to [Tailscale auth keys](https://login.tailscale.com/admin/settings/keys) and generate a key:
- **Reusable**: yes
- **Ephemeral**: no

Add it to `.env`:

```bash
TS_AUTHKEY=tskey-auth-...
```

### 2. Deploy

```bash
task up
```

The gateway pod will join your tailnet as `macbook-dev-team` (configurable via `TS_GATEWAY_HOSTNAME` in `.env`).

### 3. Get the gateway's Tailscale IP

Check the [Tailscale admin console](https://login.tailscale.com/admin/machines) for the new device. Copy its IP and add to `.env`:

```bash
TS_GATEWAY_IP=100.x.x.x
```

Redeploy so CoreDNS knows the IP:

```bash
task deploy:apply
```

### 4. Configure Split DNS

Go to [Tailscale DNS settings](https://login.tailscale.com/admin/dns):

1. Under **Nameservers**, click **Add nameserver** > **Custom**
2. Enter the gateway's Tailscale IP (e.g., `100.106.115.13`)
3. Check **Restrict to domain**
4. Enter your `DEV_HOSTNAME` (e.g., `shawns-macbook-pro`)
5. Click **Save**

Now all tailnet devices resolve `*.shawns-macbook-pro` to the gateway, which forwards HTTP traffic to Traefik.

### 5. Verify

Open a browser and go to `http://devteam.{DEV_HOSTNAME}`:

| Service | URL |
|---------|-----|
| THE Dev Team chat UI | `http://devteam.{DEV_HOSTNAME}` |
| THE Dev Team API | `http://agent-api.{DEV_HOSTNAME}` |
| Application frontend | `http://app.{DEV_HOSTNAME}` |
| Application API | `http://api.{DEV_HOSTNAME}` |
| Keycloak | `http://auth.{DEV_HOSTNAME}` |

## Day-to-day commands

```bash
task status       # check what's running
task reset:up     # nuclear option: wipe K8s state + redeploy
```

## Changing machines

If you move to a new machine or your Tailscale node changes:

```bash
# Update .env
DEV_HOSTNAME=new-machine-name
TAILSCALE_IP=100.x.x.x

# Redeploy ingresses and CoreDNS
task deploy:apply
```

Then update the Split DNS entry in the Tailscale admin console.
