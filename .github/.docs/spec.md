# CI/CD Specification

## Deployment targets

| Target    | Branch      | Registry           | Helmfile env | Workflow file          |
|-----------|-------------|--------------------|--------------|------------------------|
| mac-mini  | `mac-mini`  | `mac-mini:30500`   | `mac-mini`   | `deploy-mac-mini.yml`  |

## Trigger model

Branch name equals deployment target. Pushing to a target branch triggers the corresponding deploy workflow. Direct pushes to `main` do not trigger any deployment.

## Required secrets per target

Each deployment target needs these secrets (replace `{TARGET}` with the uppercase target name, e.g., `MAC_MINI`):

| Secret                    | Purpose                                          |
|---------------------------|--------------------------------------------------|
| `TS_OAUTH_CLIENT_ID`     | Tailscale OAuth client ID (shared across targets) |
| `TS_OAUTH_SECRET`        | Tailscale OAuth secret (shared across targets)    |
| `KUBECONFIG_{TARGET}`    | Base64 or raw kubeconfig for the target cluster   |
| `ENV_FILE_{TARGET}`      | Environment variables injected into `.env`         |
| `GITHUB_APP_PRIVATE_KEY` | Private key for the GitHub App (the-dev-team)     |

## Services built

| Service                  | Dockerfile path                                              | Build context                      |
|--------------------------|--------------------------------------------------------------|------------------------------------|
| backend                  | `projects/application/backend/dockerfiles/prod.Dockerfile`   | `projects/application/backend`     |
| frontend                 | `projects/application/frontend/dockerfiles/prod.Dockerfile`  | `projects/application/frontend`    |
| keycloak                 | `projects/application/keycloak/dockerfiles/Dockerfile`       | `projects/application/keycloak`    |
| the-dev-team-backend     | `projects/the-dev-team/backend/dockerfiles/prod.Dockerfile`  | `projects/the-dev-team/backend`    |
| the-dev-team-frontend    | `projects/the-dev-team/frontend/dockerfiles/prod.Dockerfile` | `projects/the-dev-team/frontend`   |

Each image is tagged with both `$GITHUB_SHA` and `latest`.

## Deploy workflow step sequence

1. Checkout code.
2. Connect to Tailscale (ephemeral node with `tag:ci`).
3. Configure Docker daemon for insecure registry.
4. Install Helm, Helmfile, and helm-diff plugin.
5. Write kubeconfig from secret.
6. Write `.env` file from secret, append `REGISTRY` and `IMAGE_TAG`.
7. Deploy the registry chart via Helmfile.
8. Wait for registry to become reachable (up to 60s).
9. Build and push all 5 service images.
10. Create/update the GitHub App private key as a Kubernetes secret in the `the-dev-team` namespace.
11. Deploy all charts via `helmfile -e {target} apply`.
12. Verify rollout status for all 5 deployments, print pod and ingress status.

## CI workflow

Runs on PRs to `main`. Three jobs on the self-hosted runner:

- **build** -- `npm ci` and `npm run build` for backend and frontend.
- **test** -- `npm test` for backend and frontend (depends on build).
- **lint** -- `npm run lint` for backend and frontend (parallel with build; no-ops gracefully if no lint script exists).

## Adding a new deployment target

1. Create a new workflow file: `.github/workflows/deploy-{target}.yml`.
2. Set the push trigger to the new branch name (`branches: [{target}]`).
3. Update `env.REGISTRY` and `env.DEPLOY_ENV` to match the target.
4. Add the required secrets to the repository: `KUBECONFIG_{TARGET}`, `ENV_FILE_{TARGET}`.
5. Ensure the Tailscale secrets are already configured (shared).
6. Add a Helmfile environment for the target in `infrastructure/k8s/helmfile.yaml`.
7. Push to the new branch to trigger the first deploy.
