# CI/CD Decisions

## Dispatch-only deploys

Deploys are triggered manually via `workflow_dispatch`, not by pushes to
`dev`. The `dev` branch is OpenClaw's daily-driver working branch — it
churns. Deploying on every push would stomp on the running host stack
during active work. A human decides when the current `dev` is worth
landing on host-machine.

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

## GitHub App (not PAT) for host-side GHCR pulls

host-machine authenticates to GHCR using a **GitHub App installation
token**, not a PAT. `scripts/ghcr-login.sh` mints a ~1h token on the
host using the App PEM already placed there for the openclaw git-sync
sidecar, does `docker login ghcr.io`, and the deploy script's EXIT trap
runs `docker logout` at the end.

Rationale:
- No static PAT to rotate, store, or leak.
- Single source of truth for GitHub auth on the host — the same App PEM
  that git-sync uses.
- No GitHub secrets needed for deploy (contrast with minting the token
  in CI via `actions/create-github-app-token`, which would require
  storing `GH_APP_ID` + `GH_APP_PRIVATE_KEY` as repo secrets *in
  addition* to the PEM on the host).
- Token scope is bounded to the installation + short TTL.

The App needs Packages: Read permission on this repo's GHCR packages.

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
