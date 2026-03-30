# Kubernetes

All K8s resources are orchestrated by Helmfile. Each service has a Helm chart co-located with its project code.

## Helmfile

The helmfile at `infrastructure/k8s/helmfile.yaml.gotmpl` defines all releases. Configuration is driven entirely by environment variables from `.env` — there are no per-environment values files for service config.

### Environment files

Environment YAML files (`infrastructure/k8s/environments/`) only toggle structural features:

```yaml
# mac-mini.yaml / dev.yaml
persistence: true
ingressTLS: false

# prod.yaml
persistence: true
ingressTLS: true
```

### Releases

| Release | Namespace | Chart Location | Purpose |
|---------|-----------|----------------|---------|
| registry | registry | `charts/registry` | In-cluster container registry |
| dns | dns | `charts/dns` | CoreDNS for Split DNS |
| traefik | traefik | `traefik/traefik` (remote) | Ingress controller |
| database | app | `projects/database/chart` | PostgreSQL |
| backend | app | `projects/backend/chart` | NestJS API |
| keycloak | app | `projects/keycloak/chart` | Auth service |
| frontend | app | `projects/frontend/chart` | React SPA |
| docs | app | `projects/docs/chart` | Documentation site |
| coding-agent-backend | coding-agent | `projects/coding-agent/backend/chart` | Coding agent API |
| coding-agent-frontend | coding-agent | `projects/coding-agent/frontend/chart` | Coding agent UI |
| openclaw-gateway | openclaw | `projects/openclaw/chart` | OpenClaw autonomous agent + Web UI |

## In-cluster registry

For a single-node K3s setup, a managed registry like ECR provides no benefit:

- No multi-node distribution needed — only consumer is on the same node
- No cost — ECR charges per GB; the in-cluster registry is free
- No external dependency — no internet or AWS credentials needed for deployment
- No auth complexity — K8s pulls from `localhost:30500` directly

The registry runs as a StatefulSet with persistent storage.

**When to switch to ECR/GHCR:** If you add cloud CI/CD that builds images, or if you run multiple clusters sharing images. The switch is a single env var change (`REGISTRY=your.ecr.url`).

## Kubectl context management

```bash
kubectl config use-context mac-mini   # Switch to Mac Mini
kubectl config use-context prod-ec2   # Switch to production
kubectl config get-contexts           # List all contexts
```

Getting kubeconfig from a remote K3s node:

```bash
scp user@host:/etc/rancher/k3s/k3s.yaml ~/.kube/k3s-host.yaml
# Then merge into ~/.kube/config
```

## Commands

```bash
task deploy:diff      # Preview changes
task deploy:apply     # Deploy all services
task deploy:sync      # Force apply without diff
task deploy:destroy   # Remove all services
task deploy:status    # Show pods and ingress
task deploy:logs -- backend   # Tail service logs
```

## Helm chart structure

Each project's chart follows a consistent pattern:

```
projects/service-name/chart/
├── Chart.yaml
├── values.yaml
└── templates/
    ├── deployment.yaml
    ├── service.yaml
    └── ingress.yaml
```

Charts use `{{ .Release.Name }}` for all resource names, so the same chart can be deployed with different release names.
