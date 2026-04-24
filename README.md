# Automated Coding Agent

An autonomous software development system where agents read `.docs/` specifications and sync code to match. Deploy, test, PR, iterate — humans guide the specs, agents write the code.

**Who edits what** (see top of `CLAUDE.md` for the full rationale):

- **OpenClaw** — the active agent runtime. Owns `projects/application/` (the benchmark app). Reached at `http://localhost:3001` after `task up`.
- **Claude Code** — owns OpenClaw itself (`projects/openclaw/`) plus infrastructure, CI/CD, and this repo's top-level docs. Humans iterate here.
- **THE Dev Team** (`projects/the-dev-team/`) — frozen reference. Not actively used.

## Prerequisites

### 1. Install Nix

All tooling (Node.js, Terraform, Task, etc.) is managed through a Nix flake. No manual tool installation needed.

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

### 3. Install Docker Desktop

The local stack runs on plain docker-compose. Install from [docker.com](https://www.docker.com/products/docker-desktop/) and make sure the Docker daemon is running before `task up`.

### 4. Install Tailscale (optional)

Tailscale is used for secure remote access to the production EC2 host. Local development does not require it. Install from [tailscale.com/download](https://tailscale.com/download) if you need to SSH into the deploy target.

## Setup

```bash
# 1. Enter the dev shell
cd automated-coding-agent
direnv allow    # First time — may take a few minutes to download

# 2. Create the per-project .env files
cp infrastructure/compose/dev/.env.template       infrastructure/compose/dev/.env
cp infrastructure/compose/openclaw/.env.template  infrastructure/compose/openclaw/.env
```

### What to fill in

- **`infrastructure/compose/dev/.env`** — postgres credentials and the Keycloak client secret. Defaults in the template are fine for local development.
- **`infrastructure/compose/openclaw/.env`** — Anthropic + OpenAI API keys, an `OPENCLAW_AUTH_TOKEN` (`openssl rand -hex 32`), GitHub App ID + installation ID, and the absolute host path to your GitHub App private-key PEM.

The root `.env` (from `.env.template`) is only consumed by legacy and per-project local-dev tasks (e.g. `task backend:local:run`). The compose stack reads directly from the per-project `.env` files above.

## Start

```bash
task up
```

This brings up the full compose stack: the dev application (postgres, backend, frontend, keycloak) and OpenClaw (gateway + git-sync sidecar).

On completion:
```
Application:
  Frontend: http://localhost:3000
  API:      http://localhost:3333
  Auth:     http://localhost:8080

OpenClaw:
  Web UI:   http://localhost:3001
```

## Day-to-day

```bash
task up                 # bring up dev + openclaw
task down               # stop everything (preserves volumes)
task dev:logs           # tail dev stack logs
task openclaw:logs      # tail openclaw logs
task env:create -- X    # spin up a sandbox compose project for feature X
task env:destroy -- X   # tear it down
```

See `task --list` for the full surface.

## What Nix provides

When the dev shell activates, these tools are available:

| Tool | Purpose |
|------|---------|
| Node.js 22 | Runtime for backend and frontend |
| Terraform | Production infrastructure provisioning |
| go-task | Task automation (Taskfile runner) |
| Docker CLI | Container interactions |
| AWS CLI | EC2 interaction for the production host |
| tmux | Terminal multiplexer |

## Documentation

This repo uses documentation-driven development. See `.docs/overview.md` for the full picture and `.docs/standards/docs-driven-development.md` for the convention.
