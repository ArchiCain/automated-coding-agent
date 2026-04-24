# CI/CD Specification

## Workflows

| Workflow file | Trigger | Runner | Purpose |
|---|---|---|---|
| `.github/workflows/ci.yml` | PR to `main` | self-hosted | Build + test + lint backend and frontend |
| `.github/workflows/deploy-dev.yml` | `workflow_dispatch` | ubuntu-latest | Build + push images, rsync compose, `docker compose up -d` on host-machine |

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
3. `tailscale/github-action@v2` — ephemeral node with `tag:ci`.
4. `bash scripts/deploy.sh --host ${DEPLOY_HOST} --image-tag ${SHA}`:
   a. rsync `infrastructure/compose/` → host:`/srv/aca/infrastructure/compose/`
   b. rsync `scripts/ghcr-login.sh` → host:`/srv/aca/scripts/`
   c. ssh host: source `/srv/aca/infrastructure/compose/openclaw/.env`,
      run `ghcr-login.sh` — mints a ~1h GitHub App installation token
      from the PEM already on the host, runs `docker login ghcr.io`
   d. ssh host: `docker compose … pull` for each compose project (auth via the login in step c)
   e. ssh host: `docker compose … up -d` for each compose project
   f. ssh host: `docker logout ghcr.io` (trap fires on exit, always)

`.env` files on the host stay put between deploys. Only the compose
`*.yml` files and the `ghcr-login.sh` helper are rsynced. No GHCR creds
are ever written to GitHub secrets or to the host's disk past the deploy
window.
