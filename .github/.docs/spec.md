# CI/CD Specification

## Workflows

| Workflow file | Trigger | Runner | Purpose |
|---|---|---|---|
| `.github/workflows/ci.yml` | PR to `main` | self-hosted | Build + test + lint backend and frontend |
| `.github/workflows/deploy-dev.yml` | push to `dev` (paths-ignored for docs) + manual `workflow_dispatch` | ubuntu-latest | Build + push images, rsync compose, `docker compose up -d` on host-machine |

Deploy trigger details:
- `paths-ignore`: `**/*.md`, `**/.docs/**`, `ideas/**`, `.github/CODEOWNERS`.
  OpenClaw's git-sync sidecar picks up doc/skill changes to the running
  host within 60s; no rebuild is needed for those paths.
- `concurrency: { group: deploy-dev, cancel-in-progress: true }`. A
  newer push supersedes an older deploy in flight.

## Configuration

GitHub repo-level settings the workflows read:

| Kind | Name | Purpose |
|---|---|---|
| Secret | `TAILSCALE_OAUTH_CLIENT_ID` | Join the tailnet as `tag:ci` |
| Secret | `TAILSCALE_OAUTH_SECRET` | Join the tailnet as `tag:ci` |
| Secret | `GITHUB_TOKEN` | Push images to GHCR (auto-provided by Actions) |
| Variable | `DEPLOY_HOST` | Tailscale hostname of host-machine |

No per-target env secrets — `.env` files live on host-machine and are
placed by the human during first-time bootstrap (see
`infrastructure/.docs/ecosystem.md`).

## Services built by `deploy-dev.yml`

| Service | Dockerfile | Build context |
|---|---|---|
| backend | `projects/application/backend/dockerfiles/prod.Dockerfile` | `projects/application/backend` |
| frontend | `projects/application/frontend/dockerfiles/prod.Dockerfile` | `projects/application/frontend` |
| keycloak | `projects/application/keycloak/dockerfiles/Dockerfile` | `projects/application/keycloak` |
| openclaw-gateway | `projects/openclaw/dockerfiles/prod.Dockerfile` | `projects/openclaw` |
| openclaw-git-sync | `projects/openclaw/dockerfiles/git-sync.Dockerfile` | `projects/openclaw` |

Images are tagged with both the commit SHA and `latest`, pushed to
`ghcr.io/archicain/automated-coding-agent-{service}`.

## Deploy step sequence

1. `actions/checkout@v4`.
2. Build each service image (matrix), push to GHCR using the built-in
   `GITHUB_TOKEN` with `${SHA}` and `latest` tags.
3. **Render host config** from repo secrets + vars into `/tmp/config/`
   on the runner:
   - `dev.env` (Postgres creds + Keycloak client secret)
   - `openclaw.env` (API keys, App IDs, gateway token, GIT_REPO_URL,
     PEM path, DOCKER_SOCKET_GID)
   - `github-app.pem` (the App private key)
4. `tailscale/github-action@v2` with `authkey: ${{ secrets.TS_AUTHKEY }}`
   — joins as an ephemeral `tag:ci` node.
5. `bash scripts/deploy.sh --host ${DEPLOY_HOST} --image-tag ${SHA}
   --config-dir /tmp/config`:
   a. rsync `infrastructure/compose/` → host:`/srv/aca/infrastructure/compose/`
   b. rsync `/tmp/config/dev.env` → host:`/srv/aca/infrastructure/compose/dev/.env`
   c. rsync `/tmp/config/openclaw.env` → host:`/srv/aca/infrastructure/compose/openclaw/.env`
   d. rsync `/tmp/config/github-app.pem` → host:`/srv/aca/secrets/github-app.pem` (0600)
   e. ssh host: `docker compose … pull` — GHCR packages are public, no auth
   f. ssh host: `docker compose … up -d`

The host's `/srv/aca/` layout is fully derived from repo state each
deploy. No manual `.env` placement; no persistent PEM file the operator
maintains by hand. Rotating any secret is `edit .env → task gh:setup →
git push`.
