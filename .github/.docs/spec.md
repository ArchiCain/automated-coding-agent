# CI/CD Specification

## Deployment targets

No deploy workflows are currently configured. When one is added, register it here:

| Target | Branch | Registry | Compose overlay | Workflow file |
|--------|--------|----------|-----------------|---------------|

## Trigger model

Branch name equals deployment target. Pushing to a target branch triggers the corresponding deploy workflow. Direct pushes to `main` do not trigger any deployment.

## Required secrets per target

Each deployment target needs these secrets (replace `{TARGET}` with the uppercase target name):

| Secret                    | Purpose                                          |
|---------------------------|--------------------------------------------------|
| `TS_OAUTH_CLIENT_ID`     | Tailscale OAuth client ID (shared across targets) |
| `TS_OAUTH_SECRET`        | Tailscale OAuth secret (shared across targets)    |
| `ENV_FILE_{TARGET}`      | Environment variables rsync'd onto the EC2 host  |
| `GITHUB_APP_PRIVATE_KEY` | Private key for the GitHub App used by OpenClaw's git-sync sidecar |

## Services built

| Service                  | Dockerfile path                                              | Build context                      |
|--------------------------|--------------------------------------------------------------|------------------------------------|
| backend                  | `projects/application/backend/dockerfiles/prod.Dockerfile`   | `projects/application/backend`     |
| frontend                 | `projects/application/frontend/dockerfiles/prod.Dockerfile`  | `projects/application/frontend`    |
| keycloak                 | `projects/application/keycloak/dockerfiles/Dockerfile`       | `projects/application/keycloak`    |
| openclaw-gateway         | `projects/openclaw/dockerfiles/prod.Dockerfile`              | `projects/openclaw`                |
| openclaw-git-sync        | `projects/openclaw/dockerfiles/git-sync.Dockerfile`          | `projects/openclaw`                |

Each image is tagged with both `$GITHUB_SHA` and `latest`.

## Deploy workflow step sequence

1. Checkout code.
2. Connect to Tailscale (ephemeral node with `tag:ci`).
3. Log in to GHCR.
4. Build each service image and push with `$GITHUB_SHA` + `latest` tags.
5. Rsync the compose files and the rendered `.env` onto the EC2 host over Tailscale SSH.
6. On the host: `docker compose pull`, `docker compose up -d` (with the prod overlay).
7. Verify `docker compose ps` + each service's health endpoint, fail the job on any non-healthy container.

## CI workflow

Runs on PRs to `main`. Three jobs on the self-hosted runner:

- **build** -- `npm ci` and `npm run build` for backend and frontend.
- **test** -- `npm test` for backend and frontend (depends on build).
- **lint** -- `npm run lint` for backend and frontend (parallel with build; no-ops gracefully if no lint script exists).

## Adding a new deployment target

1. Create a new workflow file: `.github/workflows/deploy-{target}.yml`.
2. Set the push trigger to the new branch name (`branches: [{target}]`).
3. Set `env.DEPLOY_ENV` to match the target.
4. Add the required secrets to the repository: `ENV_FILE_{TARGET}`.
5. Ensure the Tailscale secrets are already configured (shared).
6. Add/extend a compose overlay for the target (e.g. `infrastructure/compose/dev/compose.{target}.yml`).
7. Push to the new branch to trigger the first deploy.
8. Register the target in the "Deployment targets" table above.
