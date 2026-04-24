# Infrastructure

This directory holds the compose stacks the repo ships to the tailnet
host. See `ecosystem.md` in this same directory for the full picture
(diagrams, host roles, deploy flow, bootstrap steps).

## Directory structure

```
infrastructure/
├── .docs/
│   ├── overview.md    # This file
│   └── ecosystem.md   # The top-level map
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

`.github/workflows/deploy-dev.yml` → dispatch-only. Builds images, pushes
to GHCR, joins the tailnet, runs `scripts/deploy.sh` to rsync compose
files and `docker compose pull && up -d` on the host. Full sequence
diagram in `ecosystem.md`.
