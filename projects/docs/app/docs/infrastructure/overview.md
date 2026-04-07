# Infrastructure Overview

## Deployment stack

```
Terraform ──→ EC2 / Mac Mini running K3s (production)
                    │
                    │  Minikube (local development)
                    │
Helmfile ──→ Helm charts ──→ Kubernetes cluster
                    │
      ┌─────┬───────┼─────────────────┐
      │     │       │                 │
  Traefik  Registry  App services  THE Dev Team
  (ingress)(images)  (app ns)      (the-dev-team ns + env-* sandboxes)
```

- **Minikube** is the **primary local K8s target**. Everything runs in Kubernetes from day one, so local and production share the same topology (charts, namespaces, ingress). Use `task minikube:start` to get a cluster. See [Kubernetes](kubernetes.md).
- **Docker Compose** is **deprecated** but retained as a fallback for environments that can't run Minikube (older machines, CI runners without virtualisation). See [Docker Compose](docker-compose.md).
- **Terraform** provisions the production server — a single host running Ubuntu + K3s.
- **Helmfile** orchestrates all Kubernetes resources via Helm charts.
- **In-cluster Docker registry** stores container images at `localhost:30500` in both Minikube and K3s.
- **Traefik** handles ingress routing (installed via Helm, not K3s's bundled version).

The same Helmfile config deploys to any K3s or Minikube cluster, differing only in environment variables.

## The agent sandbox environment pattern

THE Dev Team deploys a **copy of the full application stack per active task** into an ephemeral namespace (`env-{task-id}`). This is the defining infrastructure pattern — it makes every validation gate run against a real, isolated environment.

Two Helm charts support this:

| Chart | Path | Purpose |
|-------|------|---------|
| `full-stack` | `infrastructure/k8s/charts/full-stack/` | Umbrella chart that deploys backend + frontend + database + keycloak into one namespace. Used for both the main `app` namespace and every `env-*` sandbox. |
| `the-dev-team` | `infrastructure/k8s/charts/the-dev-team/` | The orchestrator's own deployment — ServiceAccount, RBAC, Secret, Deployment, and the dashboard. |

The full-stack chart has two values files: `sandbox.yaml` (minimal resources, used for `env-*`) and `production.yaml` (production-sized, used for `app`). One chart, two personalities.

See [Sandbox Environments](../the-dev-team/sandbox-environments.md) for the full lifecycle and command reference.

## Directory structure

```
infrastructure/
├── terraform/                    # EC2 + K3s provisioning
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   └── k3s-install.sh
├── k8s/
│   ├── helmfile.yaml.gotmpl      # All release definitions
│   ├── environments/             # Per-target toggles
│   │   ├── local.yaml            # Minikube
│   │   ├── mac-mini.yaml
│   │   └── prod.yaml
│   ├── values/
│   │   └── sandbox.yaml          # Agent sandbox resource values
│   └── charts/
│       ├── registry/             # In-cluster registry
│       ├── dns/                  # CoreDNS for split DNS
│       ├── full-stack/           # Umbrella chart for sandbox envs
│       └── the-dev-team/         # Orchestrator RBAC + Secrets
├── agent-envs/
│   └── Taskfile.yml              # env:* commands (create, destroy, health, logs…)
├── history/
│   └── Taskfile.yml              # history:* commands (search, sync, cleanup)
├── minikube/
│   └── Taskfile.yml              # minikube:* commands (start, stop, tunnel…)
├── docker/
│   ├── compose.yml               # Deprecated local stack
│   └── Taskfile.yml
└── Taskfile.yml                  # Delegates to sub-Taskfiles
```

Helm charts for the **application services** live with their projects (`projects/application/*/chart/`). Infrastructure-level and cross-cutting charts live in `infrastructure/k8s/charts/`.

## Build & deploy workflow

### 1. Start the cluster

```bash
task minikube:start                    # Local K8s with ingress + registry addons
```

### 2. Build and push images

```bash
eval $(minikube docker-env)            # Point Docker CLI at Minikube's daemon
task build:all                         # Build and push all services
IMAGE_TAG=v1.2.3 task build:all        # Specific tag
```

Images push to the in-cluster registry at `$REGISTRY` (defaults to `localhost:30500`).

### 3. Deploy to the cluster

```bash
DEPLOY_ENV=local task deploy:apply     # Deploy all services (application + the-dev-team)
task deploy:diff                       # Preview changes
task deploy:status                     # Check pods across namespaces
task deploy:logs -- backend            # Tail logs
```

### 4. Create an agent sandbox

```bash
task env:create -- my-test             # Deploy a sandbox for task `my-test`
task env:health -- my-test             # Verify healthy
task env:destroy -- my-test            # Tear down
```

## Secrets management

| Environment | How secrets are managed |
|-------------|------------------------|
| Local dev | `.env` file (loaded by Taskfile's `dotenv`) |
| K8s | Helm creates K8s Secrets from `secretEnv` values |
| CI/CD | GitHub Actions secrets map to the same env vars |
| Agent pod | Dedicated `the-dev-team-agent-secrets` Secret with only Anthropic + GitHub credentials |

The agent pod is deliberately isolated from production credentials — see [Safety Model](../the-dev-team/safety-model.md#layer-7--secret-isolation).

Database passwords and API keys flow through Helmfile's `requiredEnv` at apply time — they never appear in charts or helmfile config.

## Adding a new service

1. Create `projects/myservice/chart/` (Chart.yaml, values.yaml, templates/)
2. Add a release block in `infrastructure/k8s/helmfile.yaml.gotmpl`
3. Add a `build:myservice` task to the root Taskfile and include it in `build:all`
4. Run `task build:myservice && task deploy:apply`
