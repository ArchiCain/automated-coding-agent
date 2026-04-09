# Sandbox Environments

Every active task gets its own Kubernetes namespace with a full copy of the application stack — backend, frontend, database, Keycloak. These namespaces are **ephemeral** (created at the start of a task, destroyed when the task completes) and **isolated** (no shared state with other sandboxes or with `app`).

The naming pattern is `env-{task-id}`, and every sandbox is labelled `managed-by=the-dev-team` so the orchestrator can list, inspect, and clean up its own namespaces.

## Execution mode

The orchestrator's `executionMode` defaults to `sandbox`. In sandbox mode, every task gets its own `env-{task-id}` namespace with a full application stack deployed from the `full-stack` umbrella chart.

The `EXECUTION_MODE` environment variable in the K8s deployment overrides the config file value. In the Helmfile configuration, this defaults to `sandbox`.

## Why namespace-per-task

- **Isolation** — two tasks can't step on each other's data, ports, or migrations
- **Realism** — every validation gate runs against a real K8s deployment, not a mock
- **Reproducibility** — the sandbox is created from Helm values, so anyone can re-deploy the exact same environment from the task state
- **Cheap teardown** — `kubectl delete namespace env-{id}` wipes everything atomically

## The full-stack umbrella chart

All services are deployed together from a single Helm chart: `infrastructure/k8s/charts/full-stack/`. It is a dependency-based umbrella chart that composes the individual service charts.

```
infrastructure/k8s/charts/full-stack/
├── Chart.yaml                 <- dependencies: backend, frontend, database, keycloak
├── values.yaml                <- defaults
├── templates/
│   ├── _helpers.tpl
│   ├── ingress.yaml           <- api.*, app.*, auth.* per namespace
│   ├── init-job.yaml          <- TypeORM migrations + seed
│   └── keycloak-realm-job.yaml
└── values/
    ├── sandbox.yaml           <- Minimal resources for agent sandboxes
    └── production.yaml        <- Production values for the main `app` namespace
```

Key values (`sandbox.yaml`):

```yaml
global:
  registry: localhost:30500
  imageTag: latest
  domain: localhost
  resourceProfile: sandbox

backend:   { replicas: 1, resources: { requests: { cpu: 100m, memory: 256Mi } } }
frontend:  { replicas: 1, resources: { requests: { cpu: 50m,  memory: 128Mi } } }
database:  { replicas: 1, storage: 1Gi, resources: { requests: { cpu: 100m, memory: 256Mi } } }
keycloak:  { replicas: 1, resources: { requests: { cpu: 100m, memory: 512Mi } } }
```

Sandbox resources are deliberately **minimal** — enough to validate functionality, not enough to represent production performance. Performance baselines are measured against the main `app` deployment, not against sandboxes.

## Lifecycle

### Create

```bash
task env:create -- {task-id}
```

This runs:

1. `kubectl create namespace env-{task-id}` (idempotent)
2. Label the namespace `managed-by=the-dev-team`
3. `helm install {task-id} --namespace env-{task-id} -f infrastructure/k8s/values/sandbox.yaml infrastructure/k8s/charts/full-stack`
4. `kubectl wait --for=condition=Ready pods --all -n env-{task-id} --timeout=120s`
5. A Helm `post-install` job runs TypeORM migrations against the sandbox database
6. A second post-install job imports the Keycloak realm from the committed export

Total create time is typically 60-90 seconds, dominated by Keycloak startup.

### Inspect

```bash
task env:status -- {task-id}           # pods + ingress
task env:health -- {task-id}           # hit /health on each service
task env:logs TASK_ID=abc SERVICE=backend   # stream logs from one service
task env:logs:all -- {task-id}         # stream logs from every service
task env:logs:errors -- {task-id}      # just error-level log lines
task env:exec TASK_ID=abc SERVICE=backend   # shell into a pod
task env:db:shell -- {task-id}         # psql inside the sandbox database
task env:db:query TASK_ID=abc QUERY='SELECT 1'
```

### Destroy

```bash
task env:destroy -- {task-id}
```

Runs `helm uninstall {task-id} --namespace env-{task-id} --wait || true` followed by `kubectl delete namespace env-{task-id} --wait=false`. Both are idempotent — re-running on a non-existent env is a no-op.

### List and cleanup

```bash
task env:list                          # all namespaces labelled managed-by=the-dev-team
task env:cleanup:stale -- 24           # destroy envs older than N hours
```

The scheduler runs `env:cleanup:stale 24` every hour so orphaned sandboxes don't linger if the orchestrator crashes.

## Ingress URLs

Each sandbox gets three ingress hostnames derived from the task id and the cluster's domain:

| Service | Pattern |
|---------|---------|
| Backend API | `api.{task-id}.{domain}` |
| Frontend | `app.{task-id}.{domain}` |
| Keycloak | `auth.{task-id}.{domain}` |

The `{domain}` value comes from `DEV_HOSTNAME`. Examples:

| `DEV_HOSTNAME` | Example URL for task `abc123` |
|----------------|-------------------------------|
| `localhost` (default) | `http://api.abc123.localhost` |
| `shawns-macbook` (Tailscale) | `http://api.abc123.shawns-macbook` |
| `mac-mini` (production node) | `http://api.abc123.mac-mini` |

See [Networking](../infrastructure/networking.md) for the full `DEV_HOSTNAME` explanation.

!!! note "Cluster-internal vs external access"
    Tests that run **inside** the cluster (Playwright, integration tests, the tester role) use cluster-internal DNS: `backend.env-{task-id}.svc.cluster.local:8085`. Humans and external tools use the ingress hostnames. The orchestrator uses whichever is shorter for a given call.

## `task env:*` command reference

Full reference in `infrastructure/agent-envs/Taskfile.yml`:

| Command | Purpose |
|---------|---------|
| `env:create -- {task-id}` | Create namespace + deploy full-stack chart |
| `env:destroy -- {task-id}` | Helm uninstall + delete namespace |
| `env:status -- {task-id}` | Pod + ingress status |
| `env:list` | All sandbox namespaces with age |
| `env:health -- {task-id}` | Hit health endpoints on backend + frontend |
| `env:wait-healthy` (internal) | Used by `env:create` to block until ready |
| `env:logs TASK_ID=x SERVICE=y` | Stream logs from one service |
| `env:logs:all -- {task-id}` | Stream logs from all services |
| `env:logs:errors -- {task-id}` | Only error-level lines |
| `env:build -- {task-id}` | Build all images with a task-specific tag |
| `env:db:shell -- {task-id}` | Open psql |
| `env:db:query TASK_ID=x QUERY=...` | Run a query |
| `env:exec TASK_ID=x SERVICE=y` | Shell into a pod |
| `env:port-forward TASK_ID=x SERVICE=y PORT=...` | Port-forward |
| `env:restart TASK_ID=x SERVICE=y` | Rollout restart a deployment |
| `env:cleanup:stale -- {hours}` | Delete all sandboxes older than N hours |

Agents invoke these via the `infrastructure` skill — they are **not allowed** to run raw `kubectl` or `helm` commands. Humans can use them directly during debugging.

## Running on Minikube

Minikube is the primary local K8s target. See [Kubernetes](../infrastructure/kubernetes.md) and [Infrastructure Overview](../infrastructure/overview.md). Quickstart:

```bash
task up                                # Starts Minikube, builds, and deploys everything
task minikube:tunnel                   # In a separate terminal
task env:create -- manual-test         # Create an extra sandbox for poking around
```

## Related reading

- [Execution Loop](execution-loop.md)
- [Validation Gates](validation-gates.md)
- [Kubernetes](../infrastructure/kubernetes.md)
- [Networking](../infrastructure/networking.md)
- [Taskfile Conventions](../development/taskfile.md)
