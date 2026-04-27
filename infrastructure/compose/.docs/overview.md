# Docker Compose stacks

Three compose projects make up the deploy:

- **`dev/`** — the long-lived application stack. Ports on the host:
  frontend `3000`, backend `8080`, keycloak `8081`, postgres internal only.
- **`openclaw/`** — the OpenClaw gateway + git-sync sidecar. Port `3001`.
  The gateway drives agent-led sandbox work through the host docker socket.
- **`sandbox/`** — a template project launched per-task as `env-{id}` by
  the devops agent. Full dev-stack clone per sandbox, port triple
  allocated from `20000-29990` by a deterministic hash.

The Taskfile surface wrapping these:

- `infrastructure/compose/dev/Taskfile.yml`       → `task dev:*`
- `infrastructure/compose/sandbox/Taskfile.yml`   → `task env:*`
- `projects/openclaw/Taskfile.yml`                → `task openclaw:*`

The root Taskfile chains them so `task up` = `dev:up && openclaw:up`.

## Compose layering

Each stack ships two files:

- `compose.yml` — base services, local `build:` blocks.
- `compose.prod.yml` — overlay that swaps `build:` for
  `image: ghcr.io/archicain/automated-coding-agent-{service}:${IMAGE_TAG}`.
  `scripts/deploy.sh` combines both on the host.

Host-side invocation:

```
IMAGE_TAG=<sha> docker compose \
  -f /srv/aca/infrastructure/compose/dev/compose.yml \
  -f /srv/aca/infrastructure/compose/dev/compose.prod.yml \
  pull && up -d
```

## Port model and access URLs

On host-machine, services listen on these ports. **The right hostname
depends on where the caller is standing**:

| Vantage | Hostname |
|---------|----------|
| Operator's laptop, on the tailnet | `host-machine` (or `host-machine.heron-bearded.ts.net` for HTTPS via Tailscale Serve) |
| Inside the OpenClaw gateway container (tester/worker) | `host.docker.internal` |
| On host-machine itself (SSH'd in for debugging) | `localhost` |
| Service-to-service within the same compose project | the compose service name (`backend:8080`, `postgres:5432`) |

| Service | Port |
|---------|------|
| Dev frontend | `3000` |
| Dev backend | `8080` |
| Dev Keycloak | `8081` |
| OpenClaw UI | `3001` |
| Sandbox `env-{id}` frontend | `{base}` |
| Sandbox `env-{id}` backend | `{base+1}` |
| Sandbox `env-{id}` Keycloak | `{base+2}` |

Where `{base}` = `20000 + (cksum(SANDBOX_ID) % 1000) * 10`, bumped by 10
on collision. `scripts/sandbox-deploy.sh` prints the allocated triple on
create.

When telling the user a URL, **always use the `host-machine` form** —
never `localhost`. The user's laptop is on the tailnet; `localhost` from
their seat is the laptop itself, not host-machine.

## Bringing a stack up

The dev stack reads no env — postgres user/password/db and the keycloak
client secret are baked into `infrastructure/compose/dev/compose.yml`
as literals. The openclaw stack does need an `.env` (API keys, GitHub
App credentials, etc.); the GH Actions deploy workflow renders it on
every deploy and rsyncs it to host-machine. See
`infrastructure/compose/openclaw/.env.template` for the variable set.

Manual operation on the host:

```
task up            # dev + openclaw
task dev:logs      # or openclaw:logs — stream container logs
task down          # stop both, preserve volumes
```

Individual projects are controllable directly:

```
task dev:up         task dev:down      task dev:build
task openclaw:up    task openclaw:down task openclaw:build
```

Sandboxes:

```
task env:create -- myfeature      # creates env-myfeature; prints URLs
task env:list                     # show every env-* project
task env:destroy -- myfeature     # full teardown incl. postgres volume
task env:cleanup-stale -- 24      # destroy env-* older than 24h
```

The OpenClaw devops-agent skill
(`projects/openclaw/app/skills/devops.md`) calls `task env:*` directly.
No compose-level knowledge leaks into the skill.

## Networking

Each compose project uses its own default bridge network. Service-to-service
traffic within a project is DNS-resolved by compose (e.g. backend talks to
`postgres:5432`, frontend nginx proxies `/api/` to `backend:8080`).

Cross-project traffic is not enabled. OpenClaw reaches the host docker
socket to orchestrate sandboxes via `docker compose` commands; it doesn't
open a TCP connection into the dev stack or into a sandbox.

## The docker socket and `DOCKER_SOCKET_GID`

OpenClaw's gateway runs as uid 1000 and needs to open
`/var/run/docker.sock`. On host-machine (Ubuntu), the socket is
`root:docker 660`, so set:

```
DOCKER_SOCKET_GID=$(getent group docker | cut -d: -f3)
```

in `/srv/aca/infrastructure/compose/openclaw/.env`. The compose file's
`group_add` stanza uses this as a supplemental group on the gateway
container.

## Images

Every service has its Dockerfile under
`projects/application/{backend,frontend,keycloak}/dockerfiles/` or
`projects/openclaw/dockerfiles/`. The CI deploy workflow builds with
those contexts and pushes to GHCR:

```
ghcr.io/archicain/automated-coding-agent-{backend,frontend,keycloak,openclaw-gateway,openclaw-git-sync}:${SHA}
```

`compose.prod.yml` references those images; the host pulls them on each
deploy.

Sandbox images are an exception — they're built locally on
host-machine per-sandbox and tagged `{service}:{SANDBOX_ID}`. No registry
push.

## Env-file management

`.env.template` files are tracked (`.gitignore` whitelists them).
`.env` files are not. Copy the template, populate on the host, never commit.

The OpenClaw `.env` carries `OLLAMA_API_KEY` (a non-empty placeholder
required to activate the bundled Ollama provider plugin — endpoints
themselves are pinned in `projects/openclaw/app/openclaw.json`),
`OPENCLAW_AUTH_TOKEN`, GitHub App installation ID, and the host path
to the App private-key PEM. The Honcho substack picks up
`HONCHO_DB_PASSWORD` (optional, defaults to `honcho`). No cloud LLM
API keys are required.

## Related docs

- `infrastructure/.docs/ecosystem.md` — deploy flow, host roles, diagrams
- `infrastructure/.docs/hosts.md` — concrete per-host inventory (specs, Ollama models, ports)
- `projects/openclaw/app/workspaces/devops/AGENTS.md` — how the devops agent uses `task env:*`
- `projects/{project}/dockerfiles/` — service Dockerfiles that compose builds
