# Automated Coding Agent

An autonomous software development system where agents read `.docs/` specifications and sync code to match. Deploy, test, PR, iterate — humans guide the specs, agents write the code.

## Prerequisites

### 1. Install Nix

All tooling (Node.js, Terraform, kubectl, Helm, Minikube, etc.) is managed through a Nix flake. No manual tool installation needed.

**macOS:**
```bash
sh <(curl -L https://nixos.org/nix/install)
```

**Linux:**
```bash
sh <(curl -L https://nixos.org/nix/install) --daemon
```

Restart your terminal after installation.

### 2. Install direnv

direnv automatically activates the Nix shell when you `cd` into the repo.

**macOS:**
```bash
brew install direnv
echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc
source ~/.zshrc
```

**Linux:**
```bash
sudo apt-get install direnv
echo 'eval "$(direnv hook bash)"' >> ~/.bashrc
source ~/.bashrc
```

### 3. Install Tailscale

All services are accessed via Tailscale hostnames — there is no localhost fallback.

Install from [tailscale.com/download](https://tailscale.com/download), then join the tailnet.

### 4. Install dnsmasq

dnsmasq provides wildcard DNS resolution for service hostnames (e.g., `*.shawns-macbook-pro`).

```bash
brew install dnsmasq
```

`task up` configures dnsmasq automatically.

## Setup

```bash
# 1. Enter the dev shell
cd automated-coding-agent
direnv allow    # First time — may take a few minutes to download

# 2. Create your .env file
cp .env.template .env
```

### Required `.env` values

```bash
# Tailscale
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

## Start

```bash
task up
```

This single command:
1. Starts Minikube (4 CPU, 8 GB RAM, 50 GB disk)
2. Creates K8s secrets from `.env`
3. Builds all Docker images into the cluster
4. Deploys everything via Helmfile
5. Configures dnsmasq for wildcard DNS (prompts for sudo once)
6. Starts a Traefik tunnel in a tmux session

On completion:
```
============================================
  THE Dev Team:
    Chat UI:  http://devteam.{DEV_HOSTNAME}
    API:      http://agent-api.{DEV_HOSTNAME}
  Application:
    Frontend: http://app.{DEV_HOSTNAME}
    API:      http://api.{DEV_HOSTNAME}
    Auth:     http://auth.{DEV_HOSTNAME}
============================================
```

## Day-to-day

```bash
task tunnel       # restart tunnel after reboot or pod restart
task close        # stop the tunnel
task status       # check what's running
task reset:up     # nuclear option: wipe K8s state + redeploy from scratch
```

## What Nix provides

When the dev shell activates, these tools are available:

| Tool | Purpose |
|------|---------|
| Node.js 20 | Runtime for backend and frontend |
| Terraform | Production infrastructure provisioning |
| kubectl | Kubernetes cluster management |
| Helm + Helmfile | Kubernetes package management and orchestration |
| Minikube | Local Kubernetes cluster |
| go-task | Task automation (Taskfile runner) |
| Docker CLI | Container interactions |
| tmux | Terminal multiplexer (tunnel session) |

## Documentation

This repo uses documentation-driven development. See `.docs/overview.md` for the full picture and `.docs/standards/docs-driven-development.md` for the convention.
