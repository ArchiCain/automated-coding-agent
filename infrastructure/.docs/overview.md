# Infrastructure Overview

## Deployment stack

Two targets:

- **Local development** — docker-compose on the developer's laptop, driven by `task up`. Dev + openclaw projects side-by-side; sandboxes launched on-demand as `env-{id}` compose projects.
- **Production (EC2)** — the same compose projects running on a single Ubuntu host behind Caddy on `:443`. Provisioned by Terraform; deployed over Tailscale SSH or via the `deploy-dev.yml` GitHub Actions workflow.

No Kubernetes. The k8s/Minikube setup was removed in the compose migration (see `.docs/migrations/compose/`).

```
Terraform --> Ubuntu EC2 + Docker Engine (production)
                    |
                    |  Docker Desktop (local development)
                    |
  docker-compose --> dev / openclaw / env-* compose projects
                    |
                    +---- Caddy (on EC2 only) terminates TLS, routes by Host header
                    +---- Tailscale (both) provides secure remote access
```

## Directory structure

```
infrastructure/
├── .docs/
│   ├── overview.md               # This file
│   └── ec2-reverse-proxy.md      # Caddy cert strategy + sandbox-hook contract
├── compose/
│   ├── .docs/                    # Compose-stack DDD spec
│   ├── dev/                      # Long-lived dev stack
│   ├── openclaw/                 # Gateway + git-sync
│   └── sandbox/                  # Template for env-{id} sandboxes
├── terraform/
│   ├── .docs/                    # Terraform spec
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   ├── k3s-install.sh            # EC2 bootstrap (slated to be replaced with docker + caddy)
│   └── terraform.tfvars.example
└── Taskfile.yml
```

## Where the DDD docs live

- **Compose stack (layout, ports, env files, sandboxes)** — `infrastructure/compose/.docs/overview.md`
- **EC2 reverse proxy (Caddy, certs, sandbox hooks)** — `infrastructure/.docs/ec2-reverse-proxy.md`
- **Terraform provisioning** — `infrastructure/terraform/.docs/`
- **CI/CD workflows** — `.github/.docs/` (if present)

## Secrets model

| Context | How secrets land |
|---------|------------------|
| Local dev | `.env` files in each compose project directory (`infrastructure/compose/dev/.env`, `infrastructure/compose/openclaw/.env`). Gitignored. Template files carry placeholders. |
| EC2 | Secrets rsync'd onto the host as part of the deploy flow. No AWS Secrets Manager integration yet — that's a post-migration improvement. |
| CI (GH Actions) | Standard GitHub Actions secrets. `deploy-dev.yml` references `TAILSCALE_OAUTH_*` and `GITHUB_TOKEN`. |

## Adding a new service

1. Write its Dockerfile under `projects/{project}/{service}/dockerfiles/`.
2. Add a service stanza to `infrastructure/compose/dev/compose.yml` (and the prod overlay if it needs a GHCR tag for EC2).
3. Add a matching entry to the `deploy-dev.yml` build matrix.
4. Update the Caddy config if it needs an HTTPS subdomain on EC2 (see `ec2-reverse-proxy.md`).
5. Document in the project's local `.docs/`.
