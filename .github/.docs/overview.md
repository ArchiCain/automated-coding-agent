# CI/CD Overview

Two workflows:

## `ci.yml` — PR checks

- Triggers on pull requests to `main`.
- Runs on a **self-hosted** runner on the tailnet (access to local
  services, no egress costs).
- Three jobs per project: **build**, **test**, **lint** for backend and
  frontend. `test` depends on `build`; `lint` runs in parallel with
  `build`.

## `deploy-dev.yml` — dispatch-only deploy to host-machine

- Triggers **only on `workflow_dispatch`** — no push trigger. A human
  clicks "Run workflow" from the Actions tab when they want the current
  `dev` branch on host-machine.
- Inputs: optional `host` override, optional `image_tag` override.
  Defaults to `vars.DEPLOY_HOST` and `github.sha`.
- Matrix-builds the five service images (backend, frontend, keycloak,
  openclaw-gateway, openclaw-git-sync), pushes to GHCR tagged with
  `${SHA}` and `latest`.
- Joins the tailnet as an ephemeral `tag:ci` node via
  `tailscale/github-action`.
- Runs `scripts/deploy.sh --host ${DEPLOY_HOST} --image-tag ${SHA}` which
  rsyncs the compose files to host-machine and runs
  `docker compose pull && up -d` for each compose project.

Full sequence diagram and bootstrap steps:
`infrastructure/.docs/ecosystem.md`.
