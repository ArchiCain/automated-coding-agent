# Infrastructure Overview

> Note: mid-restructure. A full ecosystem map (host roles, tailnet topology,
> deploy flow, diagrams) is coming in the next pass. This doc covers only the
> current state of what's in `infrastructure/`.

## Deploy target

Bare-metal Ubuntu host on the Tailscale tailnet. The same compose projects
that make up the stack are shipped to the host and brought up with
`docker compose up -d`. No cloud infra, no public DNS, no local-dev support.

Remote generation for agent LLM calls is handled by a separate tailnet node
(GPU box) running its own Ollama — not a concern for this directory.

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
