# Prerequisites

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
    echo 'eval "$(direnv hook bash)"' >> ~/.bashrc
    source ~/.bashrc
    ```

## Install Tailscale

Tailscale is required. All services are accessed via Tailscale hostnames — there is no localhost fallback.

Install from [tailscale.com/download](https://tailscale.com/download), then join the tailnet.

## What Nix provides

When you enter the dev shell, the following tools are available:

| Tool | Purpose |
|------|---------|
| Node.js 20 | Runtime for backend and frontend |
| npm | Package management |
| Python 3.11 | For MkDocs and scripting |
| Terraform | Production infrastructure provisioning |
| AWS CLI | AWS resource management |
| kubectl | Kubernetes cluster management |
| Helm | Kubernetes package management |
| Helmfile | Declarative Helm chart orchestration |
| Minikube | Local Kubernetes cluster |
| Colima | Lightweight Docker runtime for macOS |
| go-task | Task automation (Taskfile runner) |
| tmux | Terminal multiplexer (runs the tunnel session) |
| Docker CLI | Container interactions |
| Git | Version control |

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

No separate Docker Desktop or Colima is strictly required — Minikube brings its own Docker.

## Minikube

Minikube is the local Kubernetes target. Everything runs on K8s from day one — the main application stack, THE Dev Team agent, and sandbox environments.

`task up` handles Minikube startup automatically. If you need to start it manually:

```bash
task minikube:start
```

This runs `scripts/setup-minikube.sh`, which provisions a cluster with 4 CPUs, 8 GB RAM, 50 GB disk, and the `ingress`, `registry`, `metrics-server`, and `storage-provisioner` addons.
