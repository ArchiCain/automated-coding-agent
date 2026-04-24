# Automated Coding Agent

An autonomous software development system where agents read `.docs/`
specifications and sync code to match. Deploy, test, PR, iterate —
humans guide the specs, agents write the code.

**Who edits what** (full rationale in `CLAUDE.md`):

- **OpenClaw** — the active agent runtime. Owns `projects/application/`
  (the benchmark app). Reachable on the deploy host at
  `http://<host-machine>:3001` over the tailnet.
- **Claude Code** — owns OpenClaw itself (`projects/openclaw/`) plus
  infrastructure, CI/CD, and top-level docs. Humans iterate here.
- **The Dev Team** (`projects/the-dev-team/`) — frozen reference.

## Deployment target

The stack deploys to a bare-metal Ubuntu host on a Tailscale tailnet
(role name: **host-machine**). A second GPU host
(**graphics-machine**) serves the primary coding LLM via Ollama and is
configured out-of-band. There is no local-dev flow and no cloud infra.

See `infrastructure/.docs/ecosystem.md` for the full map — diagrams,
host roles, deploy sequence, bootstrap steps.

## Tooling

The dev shell is managed by Nix + direnv. After cloning:

### 1. Install Nix

```bash
sh <(curl -L https://nixos.org/nix/install)
```

(Linux: append `--daemon`.) Restart your terminal afterwards.

### 2. Install direnv

```bash
# macOS
brew install direnv
echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc

# Linux
sudo apt-get install direnv
echo 'eval "$(direnv hook bash)"' >> ~/.bashrc
```

### 3. Activate the dev shell

```bash
cd automated-coding-agent
direnv allow    # first time — downloads deps
```

That's it. Nix provides Node.js 22, Python 3.11, `go-task`, Docker CLI,
git, and tmux.

### 4. Install Tailscale

Required to reach the deploy host. Install from
[tailscale.com/download](https://tailscale.com/download) and join your
tailnet.

## First-time host bootstrap

See `infrastructure/.docs/ecosystem.md` → "Bootstrapping a host" for the
one-off setup on host-machine (install Docker, join tailnet, place `.env`
files and GitHub App PEM, set `vars.DEPLOY_HOST` on GitHub).

## Deploying

Auto-deploys on every push/merge to `dev` via the GitHub Actions
"Deploy to dev" workflow (`.github/workflows/deploy-dev.yml`). The
workflow builds images, pushes to GHCR, joins the tailnet, and runs
`scripts/deploy.sh` against the host.

Docs-only pushes are skipped via `paths-ignore` (the git-sync sidecar
picks those up on the host within 60s). A newer push cancels an older
deploy in flight via `concurrency: cancel-in-progress`.
`workflow_dispatch` stays available for manual redeploys. Full
sequence diagram in `infrastructure/.docs/ecosystem.md`.

## Day-to-day (on host-machine, typically via `ssh`)

```bash
task up                 # bring up dev + openclaw
task down               # stop everything (preserves volumes)
task dev:logs           # tail dev stack logs
task openclaw:logs      # tail openclaw logs
task env:create -- X    # spin up a sandbox compose project for feature X
task env:destroy -- X   # tear it down
```

See `task --list` for the full surface.

## Documentation

This repo uses documentation-driven development. See `.docs/overview.md`
for the repo map and `.docs/standards/docs-driven-development.md` for
the convention. `infrastructure/.docs/ecosystem.md` is the
architecture north star.
