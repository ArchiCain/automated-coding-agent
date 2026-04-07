# Prerequisites & Nix

All tooling is managed through a Nix flake, so you don't need to install Node.js, Terraform, kubectl, Helm, Minikube, or any other dependency manually.

## Install Nix

=== "macOS"

    ```bash
    sh <(curl -L https://nixos.org/nix/install)
    ```
    Restart your terminal after installation.

=== "Linux"

    ```bash
    sh <(curl -L https://nixos.org/nix/install) --daemon
    ```
    Restart your terminal after installation.

=== "Windows (WSL2)"

    Ensure WSL2 is installed with an Ubuntu distribution, then:
    ```bash
    sh <(curl -L https://nixos.org/nix/install)
    ```

## Install direnv

direnv automatically activates the Nix shell when you `cd` into the repo.

=== "macOS"

    ```bash
    brew install direnv
    echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc
    source ~/.zshrc
    ```

=== "Linux"

    ```bash
    sudo apt-get install direnv   # Debian/Ubuntu
    # or: sudo dnf install direnv  # Fedora
    # or: sudo pacman -S direnv    # Arch

    echo 'eval "$(direnv hook bash)"' >> ~/.bashrc
    source ~/.bashrc
    ```

## What Nix provides

When you enter the dev shell, the following tools are available:

| Tool | Purpose |
|------|---------|
| Node.js 20 | Runtime for backend, frontend, orchestrator, dashboard |
| npm | Package management |
| Python 3.11 | For MkDocs and scripting |
| Terraform | Production infrastructure provisioning |
| AWS CLI | AWS resource management |
| kubectl | Kubernetes cluster management |
| Helm | Kubernetes package management |
| Helmfile | Declarative Helm chart orchestration |
| Minikube | Local Kubernetes cluster |
| Colima | Lightweight Docker runtime for macOS (alternative to Docker Desktop) |
| go-task | Task automation (Taskfile runner) |
| Docker CLI | Container interactions |
| Git | Version control |
| gh | GitHub CLI |

The shell also installs the `helm-diff` plugin (required by Helmfile) and enables Task shell completion.

## Activating the shell

```bash
cd automated-coding-agent
direnv allow    # First time only — may take a few minutes to download
```

On subsequent visits, the shell activates automatically.

## Container runtime

You need a container runtime to build images and run Minikube:

- **macOS** — [Colima](https://github.com/abiosoft/colima) (lightweight, provided by Nix) or [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- **Linux** — Docker Engine (`sudo apt-get install docker-ce`) or Docker Desktop

On macOS the recommended path is **Minikube with its built-in Docker daemon**:

```bash
task minikube:start
eval $(minikube docker-env)   # Point Docker CLI at Minikube's internal daemon
```

No separate Docker Desktop or Colima is strictly required — Minikube brings its own Docker. This is the simplest setup and is the default path documented across this site.

## Minikube (required for local dev)

Minikube is the primary local Kubernetes target. Everything runs on K8s from day one — the main application stack, THE Dev Team orchestrator, and agent sandbox environments.

Start the cluster:

```bash
task minikube:start
```

This runs `scripts/setup-minikube.sh`, which provisions a cluster with 4 CPUs, 8 GB RAM, 50 GB disk, and the `ingress`, `registry`, `metrics-server`, and `storage-provisioner` addons.

See [Kubernetes](../infrastructure/kubernetes.md) for the full setup.

## Tailscale (optional)

If you want to reach local services from other devices (another laptop, phone, CI runner), install [Tailscale](https://tailscale.com/download) on each device and set `DEV_HOSTNAME` to the machine running Minikube. See [Environment Setup → Tailscale hostname use case](environment-setup.md#tailscale-hostname-use-case) and [Networking](../infrastructure/networking.md) for the full setup.

## Docker Compose (deprecated fallback)

Docker Compose is kept for backward compatibility but is **not the primary path**. New features (agent sandbox environments, the dashboard's per-task ingress routing) only work on Kubernetes. If you must use Compose — for example on a machine that can't virtualise — see [Docker Compose](../infrastructure/docker-compose.md) for the reduced set of services it still supports.
