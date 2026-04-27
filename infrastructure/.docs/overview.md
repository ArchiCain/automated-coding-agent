# Infrastructure

This directory holds the compose stacks the repo ships to the tailnet
host. See `ecosystem.md` in this same directory for the full picture
(diagrams, host roles, deploy flow, bootstrap steps), and `hosts.md`
for the concrete inventory of each tailnet host (specs, installed
Ollama models, listen addresses).

## Directory structure

```
infrastructure/
├── .docs/
│   ├── overview.md    # This file
│   ├── ecosystem.md   # The top-level map (roles, diagrams, deploy flow)
│   └── hosts.md       # Per-host inventory (specs, Ollama models, ports)
└── compose/
    ├── .docs/overview.md
    ├── dev/           # Long-lived application stack (frontend, backend, keycloak, postgres)
    ├── openclaw/      # OpenClaw gateway + git-sync sidecar
    └── sandbox/       # Template for per-task env-{id} compose projects
```

## Where secrets come from

| Context | Mechanism |
|---------|-----------|
| Target host | Per-compose-project `.env` files placed at `/srv/aca/infrastructure/compose/{dev,openclaw}/.env` by the human doing first-time bootstrap. Not rsynced by deploys. |
| CI | `secrets.TAILSCALE_OAUTH_*` for tailnet join; `secrets.GITHUB_TOKEN` for GHCR push; `vars.DEPLOY_HOST` for the tailnet hostname. |

## Deploy in one line

`.github/workflows/deploy-dev.yml` triggers on every push/merge to
`dev`. Builds images, pushes to public GHCR (auth: built-in
`GITHUB_TOKEN`), renders compose `.env` files + the App PEM from repo
secrets, joins the tailnet via `TS_AUTHKEY`, runs `scripts/deploy.sh`
which rsyncs everything to `/srv/aca/` on the host and runs
`docker compose pull && up -d` (no GHCR auth needed — packages are
public). Full sequence diagram in `ecosystem.md`.
