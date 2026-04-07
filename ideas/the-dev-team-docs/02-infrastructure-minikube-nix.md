# 02 — Infrastructure: Minikube + Nix

## Goal

Replace Docker Desktop and Docker Compose with a Minikube-based local development setup. All services run in K8s from day one — local and production share the same topology (Helm charts, namespace model, ingress). Nix provides all CLI tools.

## Current State

- **Nix flake** (`flake.nix`, 71 lines) already provides: Node.js 20, Python 3.11, Terraform, AWS CLI, kubectl, helm, helmfile, go-task. Does NOT include Docker engine or Minikube.
- **Docker Compose** (`infrastructure/docker/compose.yml`, 233 lines) runs 9 services locally.
- **Helm charts** exist in `infrastructure/k8s/charts/` for K8s deployment.
- **Helmfile** at `infrastructure/k8s/helmfile.yaml.gotmpl` orchestrates Helm releases.
- **Terraform** at `infrastructure/terraform/` provisions AWS EC2 + K3s for production.
- **Production** already runs K3s with Traefik, in-cluster registry at `localhost:30500`.

## Target State

- Nix provides Docker engine (via colima or nix-based docker), Minikube, and all CLI tools
- Minikube runs locally with: ingress (Traefik), in-cluster registry, persistent storage
- Same Helmfile deploys to both Minikube (local) and K3s (prod)
- No Docker Compose — `task start-local` brings up the full stack in Minikube
- Wildcard DNS routing for `*.localhost` to reach per-namespace environments

## Implementation Steps

### Step 1: Extend Nix Flake with Docker + Minikube

Edit `flake.nix` to add:

```nix
# Add to devShell packages:
minikube          # Local K8s cluster
docker-client     # Docker CLI (engine runs via colima or minikube's built-in Docker)
colima            # Lightweight Docker runtime for macOS (alternative to Docker Desktop)
```

On macOS (Darwin), Docker engine options:
- **Colima** — lightweight Lima VM with Docker. `colima start` gives you a Docker daemon. Nix can install it.
- **Minikube's built-in Docker** — `eval $(minikube docker-env)` points your Docker CLI at Minikube's internal Docker daemon. No separate Docker needed for builds.

Recommendation: Use **Minikube's Docker daemon** for image builds (`eval $(minikube docker-env)`). This means built images are immediately available inside the cluster without pushing to a registry. Simpler than running a separate Docker daemon.

### Step 2: Create Minikube Setup Script

Create `scripts/setup-minikube.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Start Minikube with sufficient resources
minikube start \
  --driver=docker \       # or hyperkit/qemu on macOS
  --cpus=4 \
  --memory=8192 \
  --disk-size=50g \
  --addons=ingress \      # Traefik or nginx ingress
  --addons=registry \     # In-cluster registry at localhost:30500
  --addons=storage-provisioner \
  --addons=metrics-server

# Enable registry addon and set up port forwarding
# The registry is accessible at localhost:30500 inside the cluster
minikube addons enable registry

# Set up wildcard DNS (macOS)
# Option A: Use nip.io (e.g., app.127.0.0.1.nip.io resolves to 127.0.0.1)
# Option B: Use dnsmasq to route *.localhost to 127.0.0.1
# Option C: Use /etc/hosts entries (manual, doesn't support wildcard)

echo "Minikube is running. Use 'eval \$(minikube docker-env)' to build images."
echo "Registry available at localhost:30500"
```

### Step 3: Create Minikube Helmfile Environment

Add a `local` environment to `infrastructure/k8s/helmfile.yaml.gotmpl` (or create `infrastructure/k8s/environments/local/values.yaml`):

```yaml
# infrastructure/k8s/environments/local/values.yaml
global:
  registry: localhost:30500
  domain: localhost          # or 127.0.0.1.nip.io
  storageClass: standard     # Minikube default
  resourceProfile: minimal   # Low CPU/memory requests for local dev

ingress:
  className: nginx           # Minikube default ingress class
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
```

### Step 4: Create Taskfile Commands for Minikube

Add to root `Taskfile.yml` or create `infrastructure/minikube/Taskfile.yml`:

```yaml
tasks:
  minikube:start:
    desc: Start Minikube cluster for local development
    cmds:
      - scripts/setup-minikube.sh

  minikube:stop:
    desc: Stop Minikube cluster
    cmds:
      - minikube stop

  minikube:delete:
    desc: Delete Minikube cluster entirely
    cmds:
      - minikube delete

  minikube:dashboard:
    desc: Open Minikube K8s dashboard
    cmds:
      - minikube dashboard

  minikube:docker-env:
    desc: Print docker-env command to use Minikube's Docker
    cmds:
      - echo 'eval $(minikube docker-env)'

  minikube:tunnel:
    desc: Start Minikube tunnel for LoadBalancer services
    cmds:
      - minikube tunnel
```

### Step 5: Update Build Tasks to Use Minikube Docker

The existing `build:*` tasks in `Taskfile.yml` build Docker images. They need to:
1. Use Minikube's Docker daemon (`eval $(minikube docker-env)`)
2. Tag images for the in-cluster registry (`localhost:30500/backend:latest`)
3. Push to the in-cluster registry

Modify existing build tasks or create wrapper tasks:

```yaml
build:backend:
  desc: Build backend Docker image for Minikube
  cmds:
    - eval $(minikube docker-env) && docker build -t localhost:30500/backend:{{.TAG | default "latest"}} -f projects/application/backend/Dockerfile projects/application/backend/
    - docker push localhost:30500/backend:{{.TAG | default "latest"}}
```

### Step 6: Deploy Full Stack to Minikube

Create a `task deploy:local` that deploys the full application stack to the `app` namespace in Minikube:

```bash
helmfile -e local apply
```

This uses the existing Helm charts with local-specific values (low resources, local registry, localhost ingress).

### Step 7: Set Up Ingress for Local Access

Configure Traefik or nginx-ingress to route:
- `app.localhost` → application frontend
- `api.localhost` → application backend
- `auth.localhost` → Keycloak
- `docs.localhost` → MkDocs site

For agent sandbox environments (Plan 09):
- `app.{task-id}.localhost` → agent's frontend
- `api.{task-id}.localhost` → agent's backend

### Step 8: Test Full Local Stack

```bash
task minikube:start
task build:all
task deploy:local
# Verify: curl http://api.localhost/health
# Verify: open http://app.localhost
```

## Verification

- [ ] `minikube start` succeeds with all required addons
- [ ] `eval $(minikube docker-env)` makes Docker CLI work without Docker Desktop
- [ ] `task build:all` builds and pushes images to in-cluster registry
- [ ] `task deploy:local` deploys all services to Minikube
- [ ] Application is accessible via ingress at `*.localhost`
- [ ] PostgreSQL data persists across `minikube stop` / `minikube start`
- [ ] Keycloak realm imports correctly on first deploy

## Open Questions

- **Minikube driver on macOS:** `docker` driver requires a Docker daemon (colima). `hyperkit` is deprecated. `qemu2` works but is slower. Test which driver is most reliable on your Mac Mini.
- **DNS routing:** `nip.io` is simplest (no config) but URLs are ugly. `dnsmasq` is cleaner but requires setup. Which do you prefer?
- **Resource sizing:** 8GB RAM for Minikube may be tight when running 4+ sandbox environments. Monitor and adjust.
- **Minikube vs kind vs k3d:** Minikube is the most mature, but k3d (K3s in Docker) would give local/prod parity since prod uses K3s. Worth considering.
