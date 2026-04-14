# Taskfile Conventions

All automation uses [go-task](https://taskfile.dev) with a hierarchical Taskfile structure.

## Command pattern

```
service-name:environment:action
```

| Segment | Meaning | Examples |
|---------|---------|----------|
| Service | Which project or namespace | `backend`, `frontend`, `devteam-backend`, `devteam-frontend`, `env`, `minikube` |
| Environment | Where it runs | `local`, `remote` |
| Action | What to do | `start`, `stop`, `test`, `build`, `lint` |

## Taskfile hierarchy

```
Taskfile.yml (root)
├── projects/application/backend/Taskfile.yml
├── projects/application/frontend/Taskfile.yml
├── projects/application/database/Taskfile.yml
├── projects/application/keycloak/Taskfile.yml
├── projects/application/e2e/Taskfile.yml
├── projects/the-dev-team/backend/Taskfile.yml
├── projects/the-dev-team/frontend/Taskfile.yml
└── infrastructure/
    ├── agent-envs/Taskfile.yml                       # env:*
    ├── minikube/Taskfile.yml                         # minikube:*
    └── k8s/Taskfile.yml                              # deploy:*
```

The root Taskfile includes all sub-Taskfiles. Environment variables from `.env` are loaded once at the root and inherited by every included task.

## Top-level commands

These are the commands you use most often:

| Command | Purpose |
|---------|---------|
| `task up` | Start Minikube, build images, deploy everything, start tunnel |
| `task tunnel` | Restart the Traefik tunnel (tmux session) |
| `task close` | Stop the tunnel |
| `task down` | Stop Minikube (preserves state for fast resume) |
| `task destroy` | Delete the Minikube cluster and all data |
| `task reset` | Wipe all K8s state (keeps Minikube VM) |
| `task reset:up` | Full reset and redeploy |
| `task setup-secrets` | Create K8s secrets from `.env` (first time only) |
| `task status` | Show Minikube status, pods, and services |
| `task logs -- SERVICE` | Tail logs (e.g. `task logs -- the-dev-team-backend`) |

## Common commands

### Build & deploy

```bash
task build:all                   # Build + push all images
task build:backend               # One service
IMAGE_TAG=v1.2.3 task build:all  # Specific tag
task deploy:diff                 # Preview changes
task deploy:apply                # Deploy all services via Helmfile
task deploy:sync                 # Force apply without diff
task deploy:status               # Pod status across namespaces
task deploy:logs -- backend      # Tail a service
```

### Agent sandbox environments (`env:*`)

| Command | Purpose |
|---------|---------|
| `task env:create -- {task-id}` | Create namespace `env-{task-id}` and deploy |
| `task env:destroy -- {task-id}` | Helm uninstall + delete namespace |
| `task env:status -- {task-id}` | Pods + ingress resources |
| `task env:list` | List all sandbox namespaces with age |
| `task env:health -- {task-id}` | Hit health endpoints |
| `task env:logs TASK_ID=x SERVICE=backend` | Stream logs |
| `task env:build -- {task-id}` | Build images tagged for a task |
| `task env:cleanup:stale -- 24` | Destroy sandboxes older than N hours |

### Testing

```bash
task run-all-tests                                  # Full test suite
task backend:local:test                             # Backend unit tests
task frontend:local:test                            # Frontend unit tests
task backend:local:test:integration                 # Backend integration tests
task frontend:local:test:integration                # Frontend integration tests
task e2e:test                                       # Playwright E2E
```

### Infrastructure provisioning (production)

```bash
task infra:init                  # Initialise Terraform
task infra:plan                  # Plan changes
task infra:apply                 # Provision EC2 + K3s
```

## Environment variable loading

The root Taskfile uses `dotenv: ['.env']` to automatically load all environment variables. Every task — including those in sub-Taskfiles — has access to the full `.env` without manual sourcing.

`DEV_HOSTNAME` (from `.env`) drives every ingress URL produced by the `env:*` and `deploy:*` tasks. See [Environment Setup](../getting-started/environment-setup.md) and [Networking](../infrastructure/networking.md).
