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
rotate. host-machine pulls via `docker login ghcr.io` (one-time, during
bootstrap).

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
