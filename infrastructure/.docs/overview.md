# Infrastructure Overview

> Note: mid-restructure. A full ecosystem map (host roles, tailnet topology,
> deploy flow, diagrams) is coming in the next pass. This doc covers only the
> current state of what's in `infrastructure/`.

## Deploy target

Bare-metal Ubuntu on the Tailscale tailnet. The same compose projects that
make up the stack are shipped to the target host and brought up with
`docker compose up -d`. No cloud infra, no public DNS, no local-dev support.

## Host roles

Two bare-metal hosts on the tailnet, split by role. Tailscale assigns the
actual hostnames; docs refer to them by role.

| Role | Runs |
|---|---|
| **host-machine** | Always-on. Compose stack (frontend, backend, keycloak, postgres), OpenClaw gateway + git-sync, sandboxes, memory embedding + fallback LLM (Ollama). |
| **graphics-machine** | Intermittent. Primary coding LLM (Ollama with GPU). OpenClaw talks to it when it's up and falls back to host-machine when it isn't. |

The graphics-machine runs outside this repo's compose stack — it's just an
Ollama endpoint the gateway is configured to call. Nothing here deploys
to it.

## Directory structure

```
infrastructure/
└── compose/
    ├── .docs/overview.md   # Compose-stack layout, ports, env files, sandboxes
    ├── dev/                # Long-lived application stack (frontend, backend, keycloak, postgres)
    ├── openclaw/           # OpenClaw gateway + git-sync sidecar
    └── sandbox/            # Template for per-task env-{id} compose projects
```

## Secrets model

| Context | How secrets land |
|---------|------------------|
| Deploy host | Per-compose-project `.env` files (`infrastructure/compose/{dev,openclaw}/.env`). Gitignored. Templates carry placeholders. |
| CI (GH Actions) | Standard GitHub Actions secrets. `deploy-dev.yml` references `TAILSCALE_OAUTH_*` and `GITHUB_TOKEN`. |

## Deploy flow

1. CI builds images on `workflow_dispatch`, pushes to GHCR.
2. CI joins the tailnet via `tailscale/github-action` OAuth.
3. `scripts/deploy.sh` rsyncs `infrastructure/compose/` to the host and runs
   `docker compose pull && up -d` for each requested project.
