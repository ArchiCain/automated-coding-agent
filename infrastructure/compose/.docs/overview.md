# Docker Compose deployment stack

All production and local deployment config lives here. Three compose projects
cover everything:

- **`dev/`** — the long-lived application stack a developer runs against.
  Ports: frontend 3000, backend 8080, Keycloak 8081, postgres internal only.
- **`openclaw/`** — the OpenClaw gateway + git-sync sidecar. Port 3001.
  Drives agent-led sandbox work through the host docker socket.
- **`sandbox/`** — a template project launched per-task as `env-{id}`.
  Full dev-stack clone per sandbox, port triple allocated from
  `20000-29990` by a deterministic hash.

The Taskfile surface wrapping these lives at:

- `infrastructure/compose/dev/Taskfile.yml`       → `task dev:*`
- `infrastructure/compose/sandbox/Taskfile.yml`   → `task env:*`
- `projects/openclaw/Taskfile.yml`                → `task openclaw:*`

The root Taskfile chains them so `task up` = `dev:up && openclaw:up`.

## Port model

Locally (macOS + Docker Desktop, or any OS running Docker Engine):

| Service | Local URL |
|---------|-----------|
| Dev frontend | `http://localhost:3000` |
| Dev backend | `http://localhost:8080` |
| Dev Keycloak | `http://localhost:8081` |
| OpenClaw UI | `http://localhost:3001` |
| Sandbox `env-{id}` frontend | `http://localhost:{base}` |
| Sandbox `env-{id}` backend | `http://localhost:{base+1}` |
| Sandbox `env-{id}` Keycloak | `http://localhost:{base+2}` |

Where `{base}` is `20000 + (cksum(SANDBOX_ID) % 1000) * 10`, bumped by 10 on
collision. `scripts/sandbox-deploy.sh` prints the allocated triple on create.

On EC2 (future), a host-level reverse proxy (tentative: Caddy) terminates TLS
and routes subdomains → these same local ports. Decision record in
`infrastructure/.docs/ec2-reverse-proxy.md`.

## Bringing a stack up

Each project has an `.env.template` documenting its variables. Before first
boot:

```
cp infrastructure/compose/dev/.env.template       infrastructure/compose/dev/.env
cp infrastructure/compose/openclaw/.env.template  infrastructure/compose/openclaw/.env
```

Fill in secrets (API keys, GitHub App credentials) in each `.env`. Then:

```
task up            # dev + openclaw, both detached
task dev:logs      # or openclaw:logs — stream container logs
task down          # stop both, preserve volumes
task up:clean      # (future) — stop + wipe volumes
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
(`projects/openclaw/app/skills/devops.md`) calls `task env:*` directly. No
compose-level knowledge leaks into the skill.

## Networking

Each compose project uses its own default bridge network. Service-to-service
traffic within a project is DNS-resolved by compose (e.g. backend talks to
`postgres:5432`, frontend nginx proxies `/api/` to `backend:8080`).

**Cross-project traffic is not enabled.** OpenClaw reaches the host docker
socket to orchestrate sandboxes via `docker compose` commands; it doesn't
open a TCP connection into the dev stack or into a sandbox.

## The docker socket and `DOCKER_SOCKET_GID`

OpenClaw's gateway runs as uid 1000 and needs to open `/var/run/docker.sock`.
Socket ownership differs by host:

| Host | Ownership | `DOCKER_SOCKET_GID` |
|------|-----------|---------------------|
| Docker Desktop (mac) | root:root 660 | `0` (default) |
| Colima (mac) | root:root 660 | `0` (default) |
| Ubuntu on EC2 | root:docker 660 | `getent group docker \| cut -d: -f3` |

Set it in `infrastructure/compose/openclaw/.env` per host. `group_add` in
`infrastructure/compose/openclaw/compose.yml` pulls it in as a supplemental
group.

## Images

Every service has its Dockerfile checked in under
`projects/application/{backend,frontend,keycloak}/dockerfiles/` or
`projects/openclaw/dockerfiles/`. Compose build contexts point at those
directories; `task *:build` invokes the builds with the right tags.

- **Dev stack** — images tagged `{service}:latest` (compose default).
- **Sandboxes** — images tagged `{service}:{SANDBOX_ID}`. `scripts/sandbox-deploy.sh`
  builds before calling `docker compose up -d`, so compose finds the image
  pre-built. Sandbox `compose.yml` carries both `image:` and `build:` blocks
  as a safety net.
- **OpenClaw** — gateway + git-sync-sidecar, each built from their respective
  Dockerfiles. No registry push in phase 5; registry arrives with the EC2
  deploy workflow in phase 5.

## Env-file management

`.env.template` files are tracked (gitignore whitelists `.env.template`).
`.env` files are ignored. Copy the template, populate, never commit.

The OpenClaw `.env` includes secrets (Anthropic API key, OpenAI key,
GitHub App installation ID, host path to the App private key PEM). Loss or
exposure requires regenerating those credentials.

## Related docs

- `infrastructure/.docs/ec2-reverse-proxy.md` — deferred ADR for HTTPS +
  subdomain URLs on EC2 (phase 5 finalizes).
- `infrastructure/terraform/.docs/` — EC2 provisioning (phase 5 updates to
  install docker + tailscale + reverse proxy instead of K3s).
- `projects/application/*/dockerfiles/` — service Dockerfiles that compose
  builds.
- `projects/openclaw/app/skills/devops.md` — how the OpenClaw devops agent
  uses the `task env:*` surface.
