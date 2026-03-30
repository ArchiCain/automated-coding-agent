# Prerequisites & Nix

All tooling is managed through a Nix flake, so you don't need to install Node.js, Terraform, kubectl, Helm, or any other dependency manually.

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
| Node.js 20 | Runtime for backend and frontend services |
| npm | Package management |
| Python 3.11 | For MkDocs and scripting |
| Terraform | Infrastructure provisioning |
| AWS CLI | AWS resource management |
| kubectl | Kubernetes cluster management |
| Helm | Kubernetes package management |
| Helmfile | Declarative Helm chart orchestration |
| go-task | Task automation (Taskfile runner) |
| Docker | Container runtime |
| Git | Version control |

The shell also installs the `helm-diff` plugin (required by Helmfile) and enables Task shell completion.

## Activating the shell

```bash
cd automated-repo
direnv allow    # First time only — may take a few minutes to download
```

On subsequent visits, the shell activates automatically. You'll see output like:

```
Dev Shell Ready:
  Node.js v20.x.x
  npm 10.x.x
  Terraform v1.x.x
  ...
```

## Docker Desktop

Nix provides the Docker CLI, but you still need a Docker runtime:

- **macOS**: Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- **Linux**: Docker Engine (`sudo apt-get install docker-ce`) or Docker Desktop
