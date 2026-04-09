# Taskfile Conventions

All automation uses [go-task](https://taskfile.dev) with a hierarchical Taskfile structure.

## Command pattern

```
service-name:environment:action
```

| Segment | Meaning | Examples |
|---------|---------|----------|
| Service | Which project or namespace | `backend`, `frontend`, `coding-agent-backend`, `env`, `history`, `minikube`, `dashboard` |
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
├── projects/coding-agent/backend/Taskfile.yml        # THE Dev Team orchestrator
├── projects/coding-agent/dashboard/Taskfile.yml      # Dashboard SPA
├── projects/docs/Taskfile.yml
└── infrastructure/
    ├── agent-envs/Taskfile.yml                       # env:*
    ├── history/Taskfile.yml                          # history:*
    ├── minikube/Taskfile.yml                         # minikube:*
    ├── docker/Taskfile.yml                           # Compose (deprecated)
    ├── k8s/Taskfile.yml
    └── terraform/Taskfile.yml
```

The root Taskfile includes all sub-Taskfiles. Environment variables from `.env` are loaded once at the root and inherited by every included task.

## Top-level commands

These are the commands you use most often:

| Command | Purpose |
|---------|---------|
| `task up` | Start Minikube + build all images + deploy everything via Helmfile |
| `task down` | Stop Minikube (preserves state for fast resume) |
| `task destroy` | Delete the Minikube cluster and all data |
| `task setup-secrets` | Create K8s secrets from `.env` (run before first deploy) |
| `task status` | Show Minikube status, pods, and services across all namespaces |
| `task logs -- SERVICE` | Tail kubectl logs for a deployment (e.g. `task logs -- coding-agent-backend`) |

## Common commands

### Local cluster (Minikube)

```bash
task minikube:start              # Start Minikube with ingress + registry + metrics-server
task minikube:stop               # Stop the cluster
task minikube:delete             # Destroy the cluster
task minikube:dashboard          # Open the Kubernetes web UI
task minikube:docker-env         # Print `eval $(minikube docker-env)`
task minikube:tunnel             # Start tunnel for LoadBalancer services
```

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
task deploy:destroy              # Remove all services
```

### Agent sandbox environments (`env:*`)

Full command reference for `infrastructure/agent-envs/Taskfile.yml`:

| Command | Purpose |
|---------|---------|
| `task env:create -- {task-id}` | Create namespace `env-{task-id}` and deploy the full-stack chart |
| `task env:destroy -- {task-id}` | Helm uninstall + delete namespace |
| `task env:status -- {task-id}` | Pods + ingress resources |
| `task env:list` | List all sandbox namespaces with age |
| `task env:health -- {task-id}` | Hit health endpoints on backend + frontend |
| `task env:logs TASK_ID=x SERVICE=backend` | Stream logs from one service |
| `task env:logs:all -- {task-id}` | Stream logs from all services in a sandbox |
| `task env:logs:errors -- {task-id}` | Only error-level log lines |
| `task env:build -- {task-id}` | Build all images tagged for a task |
| `task env:db:shell -- {task-id}` | Open psql inside the sandbox database |
| `task env:db:query TASK_ID=x QUERY='SELECT 1'` | Run a query |
| `task env:exec TASK_ID=x SERVICE=backend` | Shell into a pod |
| `task env:port-forward TASK_ID=x SERVICE=backend PORT=8085` | Port-forward |
| `task env:restart TASK_ID=x SERVICE=backend` | Rollout restart a deployment |
| `task env:cleanup:stale -- 24` | Destroy sandboxes older than N hours |

These commands are the **only** interface to the cluster for agents — raw `kubectl`/`helm`/`docker` is forbidden by the `infrastructure` skill. See [Sandbox Environments](../the-dev-team/sandbox-environments.md).

### History (`history:*`)

Full reference for `infrastructure/history/Taskfile.yml`:

| Command | Purpose |
|---------|---------|
| `task history:search -- 'pattern'` | Grep transcripts for a pattern |
| `task history:task -- {task-id}` | Print the markdown summary for a task |
| `task history:sessions -- {task-id}` | List session transcripts for a task |
| `task history:tail` | Follow the latest orchestrator events |
| `task history:costs -- 2026-04-05` | Cost rollup for a date (today if omitted) |
| `task history:failures` | Recent failed tasks with reasons |
| `task history:sync` | Trigger an immediate git sync to `the-dev-team/history` |
| `task history:cleanup -- 90` | Remove transcripts older than N days from the PVC |

See [Task State & History](../projects/coding-agent/backlog.md).

### Dashboard (`dashboard:*`)

Convenience commands for the [THE Dev Team Dashboard](../projects/coding-agent/dashboard.md):

| Command | Purpose |
|---------|---------|
| `task dashboard:local:run` | Vite dev server |
| `task dashboard:local:build` | Production bundle |
| `task dashboard:local:test` | Vitest unit tests |
| `task dashboard:local:lint` | ESLint |

### Orchestrator (`coding-agent-backend:*`)

| Command | Purpose |
|---------|---------|
| `task coding-agent-backend:local:start` | NestJS dev server |
| `task coding-agent-backend:local:build` | Compile TypeScript |
| `task coding-agent-backend:local:test` | Unit tests |
| `task coding-agent-backend:local:test:integration` | Integration tests |
| `task coding-agent-backend:local:lint` | ESLint |

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

## Adding tasks for a new project

1. Create `projects/myproject/Taskfile.yml` with your project's tasks
2. Add the include in the root `Taskfile.yml`:
   ```yaml
   includes:
     myproject: ./projects/myproject/Taskfile.yml
   ```
3. Tasks are now available as `task myproject:local:start`, etc.
