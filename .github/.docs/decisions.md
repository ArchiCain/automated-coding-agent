# CI/CD Decisions

## Branch-based deploys

Push to a named branch triggers deploy to that target. This is simpler than tag-based or release-based models: no tag management, no release promotion pipelines, and the git log on each branch is a complete audit trail of what was deployed and when.

## Self-hosted runner for CI

The CI workflow runs on a self-hosted runner. This provides access to local services needed during tests and avoids the latency and cost of GitHub-hosted runners for frequent PR checks.

## ubuntu-latest for deploy

The deploy workflow runs on ubuntu-latest because it needs full control of the Docker daemon (to configure insecure registries) and the Tailscale GitHub Action works most reliably on Linux. Self-hosted is not needed here since the runner connects to the cluster over Tailscale.

## Insecure in-cluster registry

The cluster runs a single-node registry exposed on NodePort 30500. Using an insecure (HTTP) registry avoids TLS certificate management overhead. There is no benefit from a managed registry (ECR, GHCR) since images are built and consumed within the same cluster. Tailscale provides the network security boundary.

## Tailscale for connectivity

The private cluster has no ports exposed to the public internet. The deploy runner joins the tailnet as an ephemeral node with `tag:ci`, gets access to the cluster via Tailscale DNS, and the node is automatically cleaned up after the workflow completes. This removes the need for VPNs, static IPs, or publicly exposed API servers.

## Separate CI and deploy workflows

CI and deploy are in separate workflow files because they differ in every dimension: trigger (PR vs push), runner (self-hosted vs ubuntu-latest), purpose (validation vs deployment), and required tooling. Keeping them separate makes each workflow easier to reason about and modify independently.
