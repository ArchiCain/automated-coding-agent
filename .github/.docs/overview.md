# CI/CD Overview

Two workflows:

## `ci.yml` — PR checks

- Triggers on pull requests to `main`.
- Runs on a **self-hosted** runner on the tailnet (access to local
  services, no egress costs).
- Three jobs per project: **build**, **test**, **lint** for backend and
  frontend. `test` depends on `build`; `lint` runs in parallel with
  `build`.

## `deploy-dev.yml` — auto-deploy to host-machine on push to `dev`

- Triggers on **push to `dev`** (direct commits, PR merges, force-pushes).
  `workflow_dispatch` is kept as a manual override (re-deploy a specific
  SHA, target a different host).
- `paths-ignore` skips deploys for changes that don't live in the baked
  images: `**/*.md`, `**/.docs/**`, `ideas/**`, `.github/CODEOWNERS`.
  The git-sync sidecar already pulls those to the host within 60s.
- `concurrency: deploy-dev, cancel-in-progress: true` — a newer push
  supersedes an older deploy in flight rather than queueing.
- Inputs (dispatch only): optional `host` override, optional `image_tag`
  override. Defaults to `vars.DEPLOY_HOST` and `github.sha`.
- Matrix-builds the five service images (backend, frontend, keycloak,
  openclaw-gateway, openclaw-git-sync), pushes to GHCR tagged with
  `${SHA}` and `latest`.
- Joins the tailnet as an ephemeral `tag:ci` node via
  `tailscale/github-action`.
- Runs `scripts/deploy.sh --host ${DEPLOY_HOST} --image-tag ${SHA}` which
  rsyncs the compose files + `scripts/ghcr-login.sh` to host-machine,
  logs the host's docker into GHCR using the GitHub App token, and runs
  `docker compose pull && up -d` for each compose project.

Full sequence diagram and bootstrap steps:
`infrastructure/.docs/ecosystem.md`.
