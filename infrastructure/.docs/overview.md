# Infrastructure Overview

## Deployment stack

Everything runs in Kubernetes — Minikube for local development, K3s for production. The same Helm charts and Helmfile configuration deploy to both, differing only in environment variables.

```
Terraform --> EC2 / Mac Mini running K3s (production)
                    |
                    |  Minikube (local development)
                    |
Helmfile --> Helm charts --> Kubernetes cluster
                    |
      +-----+-------+------------------+
      |     |       |                  |
  Traefik  Registry  App services   THE Dev Team
  (ingress)(images)  (app ns)       (the-dev-team ns + env-* sandboxes)
```

- **Minikube** — local K8s. Use `task up` to get a cluster with everything deployed.
- **Terraform** — provisions the production server (single host, Ubuntu + K3s).
- **Helmfile** — orchestrates all Kubernetes resources via Helm charts.
- **In-cluster registry** — stores images at `localhost:30500` in both environments.
- **Traefik** — ingress routing (installed via Helm, not K3s's bundled version).
- **Tailscale** — secure connectivity between devices and CI runners.

## The agent sandbox pattern

THE Dev Team deploys a copy of the full application stack per active task into an ephemeral namespace (`env-{task-id}`). This is the defining infrastructure pattern — every validation gate runs against a real, isolated environment.

## Directory structure

```
infrastructure/
├── .docs/
│   └── overview.md               # This file
├── k8s/
│   ├── .docs/                    # K8s docs (helmfile, networking, tailscale)
│   ├── helmfile.yaml.gotmpl
│   ├── environments/
│   ├── values/
│   ├── charts/
│   ├── minikube/                 # Minikube lifecycle tasks
│   └── agent-envs/              # Sandbox lifecycle tasks (env:*)
├── terraform/
│   ├── .docs/                    # Terraform docs
│   ├── main.tf
│   └── ...
└── Taskfile.yml
```

## Detailed documentation

- **Kubernetes, Helmfile, charts, sandboxes** — see `infrastructure/k8s/.docs/`
- **Networking, DNS, ingress** — see `infrastructure/k8s/.docs/networking.md`
- **Tailscale, split DNS, gateway** — see `infrastructure/k8s/.docs/tailscale.md`
- **Terraform provisioning** — see `infrastructure/terraform/.docs/`
- **CI/CD workflows** — see `.github/.docs/`

## Secrets management

| Environment | How secrets are managed |
|-------------|------------------------|
| Local dev | `.env` file (loaded by Taskfile's `dotenv`) |
| K8s | Helm creates K8s Secrets from `secretEnv` values |
| CI/CD | GitHub Actions secrets map to the same env vars |
| Agent pod | Dedicated `the-dev-team-agent-secrets` Secret (Anthropic + GitHub only) |

Database passwords and API keys flow through Helmfile's `requiredEnv` at apply time — they never appear in charts or helmfile config.

## Adding a new service

1. Create `projects/myservice/chart/` (Chart.yaml, values.yaml, templates/)
2. Add a release block in `infrastructure/k8s/helmfile.yaml.gotmpl`
3. Add a `build:myservice` task to the root Taskfile and include it in `build:all`
4. Run `task build:myservice && task deploy:apply`
