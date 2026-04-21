# CI/CD Overview

This repo uses GitHub Actions for continuous integration and deployment. There are two workflows with distinct responsibilities.

## Workflows

### CI (`ci.yml`)

- Triggers on pull requests to `main`.
- Runs on a **self-hosted** runner (access to local services, no egress costs).
- Three jobs: **build**, **test**, **lint** for both backend and frontend.
- `test` depends on `build`; `lint` runs in parallel with `build`.

### Deploy (`deploy-mac-mini.yml`)

- Triggers on push to the `mac-mini` branch.
- Runs on **ubuntu-latest** (needs Docker daemon control and the Tailscale GitHub Action).
- Connects to private infrastructure via Tailscale (ephemeral node, `tag:ci`).
- Builds all 5 service images, pushes to an in-cluster registry at `mac-mini:30500`.
- Deploys via Helmfile targeting the `mac-mini` environment.

## Key infrastructure details

- **No managed container registry.** Images go to an insecure in-cluster registry exposed on a NodePort.
- **Tailscale** provides connectivity from the GitHub-hosted runner to the private cluster. No ports are exposed to the public internet.
- **Branch-based deploys.** The branch name determines the deployment target. There is no tag-based or release-based deploy mechanism.
