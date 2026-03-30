# Infrastructure Overview

## Deployment stack

```
Terraform ──→ EC2 instance with K3s
                    │
Helmfile ──→ Helm charts ──→ K3s cluster
                    │
              ┌─────┼─────────────────┐
              │     │                 │
          Traefik  Registry    App Services
          (ingress) (images)   (pods)
```

- **Terraform** provisions the server — a single EC2 instance running Ubuntu + K3s
- **Helmfile** orchestrates all Kubernetes resources via Helm charts
- **In-cluster Docker registry** stores container images
- **Traefik** handles ingress routing (installed via Helm, not K3s's bundled version)

The same Helmfile config deploys to any K3s node — Mac Mini, Raspberry Pi, or EC2 — differing only in environment variables.

## Directory structure

```
infrastructure/
├── terraform/               # EC2 + K3s provisioning
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   └── k3s-install.sh      # User data script
├── k8s/
│   ├── helmfile.yaml.gotmpl # All release definitions
│   ├── environments/        # Per-target toggles
│   │   ├── mac-mini.yaml
│   │   ├── dev.yaml
│   │   └── prod.yaml
│   └── charts/
│       ├── registry/        # In-cluster container registry
│       └── dns/             # CoreDNS for Split DNS
├── docker/
│   ├── compose.yml          # Local development stack
│   ├── coding-agent-nginx.conf
│   └── Taskfile.yml
└── Taskfile.yml             # Delegates to sub-Taskfiles
```

Helm charts for application services live with their projects (`projects/*/chart/`), not in `infrastructure/`.

## Build & deploy workflow

### 1. Build and push images

```bash
task build:all                    # All services
task build:backend                # Just one service
IMAGE_TAG=v1.2.3 task build:all  # Specific tag
```

Images push to the in-cluster registry at `$REGISTRY` (defaults to `mac-mini:30500`).

### 2. Deploy to the cluster

```bash
DEPLOY_ENV=mac-mini task deploy:apply   # Deploy to Mac Mini
task deploy:diff                        # Preview changes
task deploy:status                      # Check pods
task deploy:logs -- backend             # Tail logs
```

### 3. Full deploy from scratch

```bash
task build:all
DEPLOY_ENV=mac-mini task deploy:apply
task deploy:status
```

## Secrets management

| Environment | How secrets are managed |
|-------------|------------------------|
| Local dev | `.env` file (loaded by Taskfile's `dotenv`) |
| K8s | Helm creates K8s Secrets from `secretEnv` values |
| CI/CD | GitHub Actions secrets map to the same env vars |

Database passwords and API keys flow through Helmfile's `requiredEnv` at apply time — they never appear in charts or helmfile config.

## Adding a new service

1. Create `projects/myservice/chart/` (Chart.yaml, values.yaml, templates/)
2. Add a release block in `infrastructure/k8s/helmfile.yaml.gotmpl`
3. Add a `build:myservice` task to the root Taskfile
4. Add it to `build:all`
5. Run `task build:myservice && task deploy:apply`
