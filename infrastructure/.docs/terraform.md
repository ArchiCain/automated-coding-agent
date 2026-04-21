# Terraform

Terraform is intentionally minimal. It provisions a single EC2 instance with K3s — everything else is managed by Helmfile.

## What Terraform manages

- EC2 instance (Ubuntu 24.04) with K3s installed via user data script
- Elastic IP for stable addressing
- EBS data volume (persistent storage for K3s)
- Security group (SSH, HTTP, HTTPS, K3s API on 6443)

K3s is installed with `--disable=traefik` so Traefik is managed via Helm alongside everything else.

## When Terraform isn't used

For the Mac Mini and Pi cluster, Terraform isn't used — K3s is installed directly on the hardware.

## Commands

```bash
task infra:init      # Initialize Terraform
task infra:plan      # Plan changes
task infra:apply     # Provision EC2 + K3s
task infra:destroy   # Tear down
task infra:output    # Show IP, SSH command, kubeconfig instructions
```

## Directory structure

```
infrastructure/terraform/
├── main.tf              # EC2 instance, EBS, EIP, security group
├── variables.tf
├── outputs.tf
├── k3s-install.sh       # User data: installs K3s
├── terraform.tfvars.example
└── Taskfile.yml
```
