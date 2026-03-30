# Infrastructure & Deployment

Infrastructure provisioning, container registry strategy, and deployment patterns.

## Architecture Overview

The deployment stack is:

- **Terraform (OpenTofu)** provisions the server — a single EC2 instance running Ubuntu + K3s
- **Helmfile** orchestrates all Kubernetes resources via Helm charts
- **In-cluster Docker registry** stores container images
- **Traefik** handles ingress routing (installed via Helm, not K3s's bundled version)

The same Helmfile config deploys to any K3s node — Mac Mini, Raspberry Pi cluster, or EC2 — differing only in env vars.

### Directory Structure

```
infrastructure/
├── terraform/                # EC2 + K3s provisioning
│   ├── main.tf              # EC2 instance, EBS, EIP, security group
│   ├── variables.tf
│   ├── outputs.tf
│   ├── k3s-install.sh       # User data: installs K3s with Traefik disabled
│   └── terraform.tfvars.example
└── k8s/
    ├── helmfile.yaml         # Orchestrates all releases
    ├── environments/         # Per-target toggles (mac-mini, dev, prod)
    │   ├── mac-mini.yaml
    │   ├── dev.yaml
    │   └── prod.yaml
    └── charts/
        └── registry/         # In-cluster container registry

projects/
├── backend/chart/            # Helm chart co-located with project
├── frontend/chart/
├── keycloak/chart/
└── database/chart/
```

## Container Registry: Why In-Cluster Instead of ECR

For a single-node K3s setup, a managed registry like ECR provides no practical benefit:

- **No multi-node distribution needed** — the only image consumer is the same node that stores the images
- **No cost** — ECR charges per GB stored and per GB transferred; the in-cluster registry is free
- **No external dependency** — deployment doesn't require internet access or AWS credentials
- **No auth complexity** — K8s pulls from `localhost:30500` with no image pull secrets needed
- **Same developer experience** — `docker build && docker push` works identically

The registry runs as a StatefulSet with persistent storage inside the cluster. Images survive pod restarts.

**When to switch to ECR/GHCR:** If you add GitHub Actions CI/CD that builds images in the cloud, or if you run multiple clusters that need to share images. The switch is a single env var change (`REGISTRY=123456789.dkr.ecr.us-east-1.amazonaws.com`) — no chart or helmfile modifications required.

## Terraform Scope

Terraform is intentionally minimal. It provisions:

- EC2 instance (Ubuntu 24.04) with K3s installed via user data script
- Elastic IP for stable addressing
- EBS data volume (persistent storage for K3s)
- Security group (SSH, HTTP, HTTPS, K3s API on 6443)

K3s is installed with `--disable=traefik` so Traefik is managed via Helm alongside everything else.

For the Mac Mini and Pi cluster, Terraform isn't used at all — K3s is installed directly.

### Task Commands

```bash
task infra:init     # Initialize Terraform
task infra:plan     # Plan changes
task infra:apply    # Provision EC2 + K3s
task infra:destroy  # Tear down
task infra:output   # Show IP, SSH command, kubeconfig instructions
```

## Build & Deploy Workflow

### 1. Build and push images

```bash
task build:all                    # Build and push all services
task build:backend                # Just the backend
IMAGE_TAG=v1.2.3 task build:all  # Tag a specific version
```

Images are pushed to the in-cluster registry at `$REGISTRY` (defaults to `localhost:30500` for local, `mac-mini:30500` for remote).

### 2. Deploy to the cluster

```bash
DEPLOY_ENV=mac-mini task deploy:apply   # Deploy to Mac Mini
DEPLOY_ENV=prod task deploy:apply       # Deploy to production EC2
task deploy:diff                        # Preview changes
task deploy:status                      # Check pod status
task deploy:logs -- backend             # Tail logs for a service
```

### 3. Full deploy from scratch

```bash
task build:all
DEPLOY_ENV=mac-mini task deploy:apply
task deploy:status
```

## Helmfile Configuration

All configuration is driven by environment variables loaded from `.env`. The helmfile uses `env` and `requiredEnv` template functions — no per-environment values files for service config.

Environment YAML files (`environments/*.yaml`) only toggle structural features:

```yaml
# mac-mini.yaml / dev.yaml
persistence: true
ingressTLS: false

# prod.yaml
persistence: true
ingressTLS: true
```

### Adding a New Service

1. Create `projects/myservice/chart/` (Chart.yaml, values.yaml, templates/)
2. Add a release block in `helmfile.yaml` pointing to `../../projects/myservice/chart`
3. Add a `build:myservice` task to the root Taskfile
4. Run `task build:myservice && task deploy:apply`

## Secrets Management

- **Local dev:** `.env` file (loaded by Taskfile's `dotenv`)
- **K8s:** Helm creates K8s Secrets from `secretEnv` values injected via env vars
- **CI/CD:** GitHub Actions secrets map directly to the same env vars

Database passwords and API keys are never in the helmfile or charts — they flow through `requiredEnv` at apply time.

## Kubectl Context Management

Multiple clusters are managed via kubectl contexts:

```bash
kubectl config use-context mac-mini   # Switch to Mac Mini
kubectl config use-context prod-ec2   # Switch to production
kubectl config get-contexts           # List all contexts
```

Kubeconfig for remote K3s nodes is fetched with:
```bash
scp user@host:/etc/rancher/k3s/k3s.yaml ~/.kube/k3s-host.yaml
# Then merge into ~/.kube/config
```

## Related Documentation

- [Docker](docker.md) — Container patterns and local development
- [Environment Configuration](environment-configuration.md) — `.env` management
- [Task Automation](task-automation.md) — Task command reference
