# Kubernetes

All K8s resources are orchestrated by Helmfile. Each service has a Helm chart co-located with its project code. Infrastructure-level charts live in `infrastructure/k8s/charts/`.

## Local cluster: Minikube

Minikube is the **primary local Kubernetes target** for this repo. Everything — the main application stack, THE Dev Team orchestrator and dashboard, and all agent sandbox environments — runs in Minikube when developing locally. The same Helm charts deploy to K3s in production.

### Starting Minikube

```bash
task minikube:start          # Start with ingress + registry + metrics-server addons
task minikube:stop           # Stop without deleting state
task minikube:delete         # Destroy the cluster entirely
task minikube:dashboard      # Open the Kubernetes web UI
task minikube:tunnel         # Start tunnel for LoadBalancer services
```

`task minikube:start` runs `scripts/setup-minikube.sh`, which starts Minikube with 4 CPUs, 8 GB RAM, 50 GB disk, and enables:

- `ingress` (nginx ingress controller, matches prod Traefik semantics)
- `registry` (in-cluster registry at `localhost:30500`, same address as K3s)
- `storage-provisioner` (dynamic PVs)
- `metrics-server` (so the dashboard can show CPU/memory for sandboxes)

### Building images into Minikube

To avoid round-tripping images through an external registry, point the Docker CLI at Minikube's Docker daemon:

```bash
eval $(minikube docker-env)
task build:all
```

Images built this way are immediately available inside the cluster. The existing `build:*` tasks push to `localhost:30500`, which is visible both inside the cluster and from the host.

The full command reference lives in `infrastructure/minikube/Taskfile.yml`.

## Production cluster: K3s

Production runs K3s on a single host (Mac Mini or EC2), provisioned by Terraform. The same Helm charts deploy to both. Environment differences are encoded in `infrastructure/k8s/environments/{env}.yaml`.

## Helmfile

`infrastructure/k8s/helmfile.yaml.gotmpl` defines all releases. Configuration is driven entirely by environment variables from `.env` — there are no per-environment values files for service config.

### Environment files

Environment YAML files (`infrastructure/k8s/environments/`) only toggle structural features:

```yaml
# local.yaml (Minikube) / mac-mini.yaml
persistence: true
ingressTLS: false
ingressClassName: nginx

# prod.yaml
persistence: true
ingressTLS: true
ingressClassName: traefik
```

### Releases

| Release | Namespace | Chart | Purpose |
|---------|-----------|-------|---------|
| registry | registry | `charts/registry` | In-cluster container registry |
| dns | dns | `charts/dns` | CoreDNS for split DNS |
| traefik | traefik | `traefik/traefik` (remote) | Ingress controller (K3s) |
| database | app | `projects/application/database/chart` | PostgreSQL + pgvector |
| backend | app | `projects/application/backend/chart` | NestJS API |
| keycloak | app | `projects/application/keycloak/chart` | Auth service |
| frontend | app | `projects/application/frontend/chart` | React SPA |
| docs | app | `projects/docs/chart` | Documentation site |
| the-dev-team-backend | the-dev-team | `projects/the-dev-team/backend/chart` | Orchestrator: RBAC, Secrets, Deployment |
| the-dev-team-frontend | the-dev-team | `projects/the-dev-team/frontend/chart` | Chat UI + cluster visualization |

The `the-dev-team-backend` release is the **orchestrator's own deployment** (ServiceAccount, ClusterRole, secrets, Deployment). It's separate from the agent sandbox environments, which use the `full-stack` umbrella chart.

## Sandbox namespaces (`env-*`)

Sandbox namespaces are **not** created by Helmfile — they're created on-demand by the orchestrator via `task env:create -- {task-id}`. Each sandbox is a separate Helm release in its own namespace, using `infrastructure/k8s/charts/full-stack` with `infrastructure/k8s/values/sandbox.yaml`.

See [Sandbox Environments](../the-dev-team/sandbox-environments.md) for the full lifecycle.

## In-cluster registry

For a single-node cluster, a managed registry like ECR provides no benefit:

- No multi-node distribution needed — only consumer is on the same node
- No cost — ECR charges per GB; the in-cluster registry is free
- No external dependency — no internet or AWS credentials needed for deployment
- No auth complexity — K8s pulls from `localhost:30500` directly

The registry runs as a StatefulSet with persistent storage in both Minikube and K3s.

**When to switch to ECR/GHCR:** if you add cloud CI/CD that builds images, or if you run multiple clusters sharing images. The switch is a single env var change (`REGISTRY=your.ecr.url`).

## Kubectl context management

```bash
kubectl config use-context minikube     # Local Minikube
kubectl config use-context mac-mini     # Mac Mini K3s
kubectl config use-context prod-ec2     # Production
kubectl config get-contexts             # List all contexts
```

Getting kubeconfig from a remote K3s node:

```bash
scp user@host:/etc/rancher/k3s/k3s.yaml ~/.kube/k3s-host.yaml
# Then merge into ~/.kube/config
```

## Commands

```bash
task deploy:diff                 # Preview changes
task deploy:apply                # Deploy all services
task deploy:sync                 # Force apply without diff
task deploy:destroy              # Remove all services
task deploy:status               # Show pods and ingress across namespaces
task deploy:logs -- backend      # Tail a service
```

For sandbox management:

```bash
task env:create -- {task-id}
task env:status -- {task-id}
task env:destroy -- {task-id}
task env:list
```

See [Taskfile Conventions](../development/taskfile.md).

## Helm chart structure

Each project's chart follows the same pattern:

```
projects/service-name/chart/
├── Chart.yaml
├── values.yaml
└── templates/
    ├── deployment.yaml
    ├── service.yaml
    └── ingress.yaml
```

Charts use `{{ .Release.Name }}` for all resource names so the same chart can be deployed with different release names — this is what makes the `full-stack` umbrella chart work for both the main `app` namespace and every `env-*` sandbox.
