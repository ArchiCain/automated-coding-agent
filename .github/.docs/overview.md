# CI/CD Overview

This repo uses GitHub Actions for continuous integration. No deployment workflows are currently configured.

## Workflows

### CI (`ci.yml`)

- Triggers on pull requests to `main`.
- Runs on a **self-hosted** runner (access to local services, no egress costs).
- Three jobs: **build**, **test**, **lint** for both backend and frontend.
- `test` depends on `build`; `lint` runs in parallel with `build`.

## Deployment

Deployment workflows are not currently configured. Local deploys happen via `task up` against Minikube. See `.github/.docs/spec.md` for the pattern a future deploy workflow should follow.
