# Rapid AI Development Template

A comprehensive template for building AI-powered applications with enterprise-grade architecture, modern development tools, and proven patterns.

## 📚 Documentation

**[Complete Documentation →](docs/README.md)**

## Quick Start

> **Prerequisites**: macOS, Linux, or WSL2 on Windows

## Getting Started

### 1. Install Dependencies

<details>
<summary><b>macOS</b></summary>

**Install Nix**:
```bash
sh <(curl -L https://nixos.org/nix/install)
```
After installation, restart your terminal or run:
```bash
. ~/.nix-profile/etc/profile.d/nix.sh
```

**Install direnv**:
```bash
brew install direnv
```

**Configure your shell**:
- **For Zsh (default):**
  ```bash
  echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc
  source ~/.zshrc
  ```
- **For Bash:**
  ```bash
  echo 'eval "$(direnv hook bash)"' >> ~/.bash_profile
  source ~/.bash_profile
  ```
</details>

<details>
<summary><b>Linux</b></summary>

**Install Nix**:
```bash
sh <(curl -L https://nixos.org/nix/install) --daemon
```
After installation, restart your terminal or run:
```bash
. ~/.nix-profile/etc/profile.d/nix.sh
```

**Install direnv**:
```bash
# For Ubuntu/Debian
sudo apt-get update && sudo apt-get install direnv

# For Fedora
sudo dnf install direnv

# For Arch Linux
sudo pacman -S direnv
```

**Configure your shell**:
- **For Bash:**
  ```bash
  echo 'eval "$(direnv hook bash)"' >> ~/.bashrc
  source ~/.bashrc
  ```
- **For Zsh:**
  ```bash
  echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc
  source ~/.zshrc
  ```
</details>

<details>
<summary><b>Windows (WSL2)</b></summary>

First, ensure WSL2 is installed and you have a Linux distribution like Ubuntu.

**Install Nix**:
```bash
sh <(curl -L https://nixos.org/nix/install)
```
After installation, restart your terminal or run:
```bash
. ~/.nix-profile/etc/profile.d/nix.sh
```

**Install direnv**:
```bash
# For Ubuntu/Debian
sudo apt-get update && sudo apt-get install direnv
```

**Configure your shell**:
```bash
# If using Bash
echo 'eval "$(direnv hook bash)"' >> ~/.bashrc
source ~/.bashrc

# If using Zsh
echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc
source ~/.zshrc
```
</details>

### 2. Set Up Your Project

**Initialize direnv**:
```bash
cd your-project-name
direnv allow  # This may take a few minutes first time
```

**Configure your project**:
```bash
# First, create and configure your .env file
cp .env.template .env
# Edit .env file and fill in your AWS credentials and project settings

# Then run setup to configure AWS profiles
task setup-workspace  # Checks if AWS is working or provides setup instructions
```

> **Note**: For SSO users, the setup script will provide specific commands to run for configuring your AWS SSO profile. For static credentials, it will configure everything automatically.

**Deploy infrastructure**:
```bash
# One-time setup: Initialize remote state infrastructure
task terraform:aws:setup-remote-state
```

**Start the development stack**:
```bash
# Start all services in Docker (backend, frontend, keycloak, database)
task start-local

# View logs
task logs-local
```

## 📖 Learn More

**[→ Read the Complete Documentation](docs/README.md)**