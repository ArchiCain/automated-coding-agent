# CI/CD Decisions

## Auto-deploy on push to `dev`

Deploys fire automatically on every push/merge to `dev`. The feedback
loop from "PR merged" to "running on the host" is the whole point —
gating it behind a manual dispatch turned every deploy into a separate
chore. `workflow_dispatch` is kept only as a manual override (redeploy
a specific SHA, target a different host for a one-off test).

The stomping concern (OpenClaw commits doc/skill edits directly to
`dev` as part of Stream A, each push triggering a full rebuild) is
addressed by:

- **`paths-ignore`** on the push trigger: `**/*.md`, `**/.docs/**`,
  `ideas/**`, `.github/CODEOWNERS`. These are the paths the git-sync
  sidecar already refreshes on the host within 60s without a rebuild.
- **`concurrency: cancel-in-progress: true`**: two pushes in quick
  succession collapse to one deploy — the newer one cancels the older.

## Tailscale for connectivity, not ingress

Host-machine has no public ingress. The CI runner joins the tailnet as
an ephemeral `tag:ci` node to reach the host over `ssh`. The tailnet is
the whole network boundary — no VPN, no static IPs, no publicly
exposed API surface.

## GHCR for the image registry

Images push to GHCR (`ghcr.io/archicain/automated-coding-agent-*`) because
the Actions runner already has a `GITHUB_TOKEN` with packages:write
permission — no extra cloud provider account, no registry secrets to
rotate.

## Public GHCR packages — no host-side auth needed

This repo is public. GHCR packages linked to a public repo are free and
unlimited for storage + bandwidth, and `docker pull` against a public
package requires no authentication. So the host doesn't do
`docker login ghcr.io` at deploy time — it just pulls.

The GitHub App is still used on the host, but only by the OpenClaw
git-sync sidecar for cloning the repo. App permissions required:
**Contents: Read**, **Metadata: Read**. No Packages permission needed.

One-time manual step after the first deploy: each new GHCR package
defaults to private even when pushed by a workflow on a public repo.
Visit each package's settings and flip visibility to Public.

## Laptop-as-source-of-truth for GH secrets + variables

All values the workflow reads — secrets like `TS_AUTHKEY`,
`POSTGRES_PASSWORD`, `GITHUB_APP_PRIVATE_KEY`, and variables like
`DEPLOY_HOST`, `GITHUB_APP_ID`, `DOCKER_SOCKET_GID` — live in a single
root `.env` on the developer's laptop. `scripts/gh-setup.sh` reads that
file, previews (char counts only), and pushes each value to the repo
via `gh` over stdin (values never appear in argv).

Rationale:
- **One rotation mechanism.** Edit `.env`, re-run `task gh:setup`.
- **No click-through GitHub UI onboarding.** A fresh clone with a
  populated `.env` is one command away from a deployable repo.
- **Stdin-only.** `gh secret set --body "$VAL"` shows values in `ps` /
  shell history. The stdin form doesn't.
- **Variables, not secrets, for non-sensitive values.** Hostnames, IDs,
  and gids don't get masked as `***` in logs, which matters when
  debugging a failing run.

## Self-hosted runner for CI, GitHub-hosted for deploy

`ci.yml` runs on a self-hosted runner on the tailnet so tests can reach
local services without egress. `deploy-dev.yml` runs on
`ubuntu-latest` because it needs a clean environment with full Docker
control for building images, and the Tailscale GitHub Action is
well-supported there. Deploy reaches host-machine the same way CI does —
over the tailnet.

## Separate CI and deploy workflows

CI and deploy differ in every dimension: trigger (PR vs dispatch),
runner (self-hosted vs GitHub-hosted), purpose (validation vs
deployment), and required tooling. Keeping them separate makes each
workflow easier to reason about and modify independently.
