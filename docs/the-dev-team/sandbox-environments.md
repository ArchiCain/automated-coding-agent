# Sandbox Environments

The agent can deploy ephemeral Kubernetes namespaces with a full copy of the application stack -- backend, frontend, database, Keycloak. These namespaces are created per-worktree, isolated from each other and from the main `app` namespace.

The naming pattern is `env-{name}`, and every sandbox is labelled `managed-by=the-dev-team` so the system can list, inspect, and clean up its own namespaces.

## Why namespace-per-worktree

- **Isolation** -- two tasks can't step on each other's data, ports, or migrations
- **Realism** -- changes are validated against a real K8s deployment, not a mock
- **Reproducibility** -- the sandbox is created from Helm values, so anyone can re-deploy the exact same environment
- **Cheap teardown** -- `kubectl delete namespace env-{name}` wipes everything atomically

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
    └── production.yaml        <- Production values for the main app namespace
```

## MCP tools

The agent interacts with sandboxes through structured MCP tools:

| Tool | Purpose |
|------|---------|
| `create_worktree` | Create a git worktree with a new branch for isolated development |
| `deploy_sandbox` | Build Docker images from a worktree and deploy full stack to `env-{name}` |
| `destroy_sandbox` | Tear down a sandbox (Helm uninstall + delete namespace) |
| `list_sandboxes` | List all active sandbox environments |
| `sandbox_status` | Check health and pod status of a sandbox |
| `sandbox_logs` | View recent logs from a service in a sandbox |

The `deploy_sandbox` tool delegates to `task env:deploy` which handles: docker build, push to in-cluster registry, helm install, and wait for health.

## Taskfile commands

The sandbox lifecycle is managed by `infrastructure/agent-envs/Taskfile.yml`:

| Command | Purpose |
|---------|---------|
| `env:deploy` | Build images + deploy full-stack chart to a namespace |
| `env:destroy` | Helm uninstall + delete namespace |
| `env:list` | All sandbox namespaces with age |
| `env:health` | Hit health endpoints on backend + frontend |
| `env:create` | Create namespace + deploy chart |
| `env:status` | Pod + ingress status |

## Ingress URLs

Each sandbox gets ingress hostnames derived from the sandbox name and the cluster's domain:

| Service | Pattern |
|---------|---------|
| Backend API | `api.{name}.{domain}` |
| Frontend | `app.{name}.{domain}` |
| Keycloak | `auth.{name}.{domain}` |

The `{domain}` value comes from `DEV_HOSTNAME` in the environment.

## Related reading

- [Backend](../projects/the-dev-team/backend.md)
- [Kubernetes](../infrastructure/kubernetes.md)
- [Networking](../infrastructure/networking.md)
