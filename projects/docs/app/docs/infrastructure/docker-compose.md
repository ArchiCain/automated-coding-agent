# Docker Compose

!!! warning "Deprecated"
    Docker Compose is **deprecated** as the primary local development target. Use [Minikube](kubernetes.md#local-cluster-minikube) instead. The Compose stack is retained only for backward compatibility on machines that can't run Minikube (older hardware, CI environments without virtualisation).

    New features — agent sandbox environments, THE Dev Team dashboard, per-task ingress routing — **only work on Kubernetes**. They are not wired into Compose and will not be.

The local development stack is defined in `infrastructure/docker/compose.yml`. It runs the core application services with hot reload and volume mounts.

## Services (current, trimmed)

| Service | Image | Port | Notes |
|---------|-------|------|-------|
| database | Custom (pgvector) | 5437 | Persistent volume, `pg_isready` health check |
| pgweb | `sosedoff/pgweb` | 8082 | Database web UI |
| backend | Custom (NestJS) | 8085 | Volume-mounted source, hot reload |
| keycloak | Custom | 8081 | Realm auto-import, shared DB |
| frontend | Custom (React/Vite) | 3000 | Volume-mounted source, hot reload |
| docs | Custom (MkDocs) | 8083 | Volume-mounted source, live reload |

Services that have been **removed** from compose and moved to Kubernetes-only:

- `openclaw-gateway` — removed entirely (OpenClaw has been replaced by THE Dev Team)
- `coding-agent-frontend` — the Angular UI has been replaced by the React-based [THE Dev Team Dashboard](../projects/the-dev-team-dashboard.md), which only runs in K8s
- Agent sandbox environments (`env-*`) — K8s-only by design

The `coding-agent-backend` (THE Dev Team orchestrator) is still present in Compose for local development of the orchestrator itself, but it cannot create sandbox namespaces when running under Compose.

## Dockerfile patterns

Each project has two Dockerfiles:

- **`local.Dockerfile`** — Development: volume mounts, hot reload, dev dependencies
- **`prod.Dockerfile`** — Production: multi-stage build, minimal image, nginx for static sites

## Dependencies

Services declare health checks and dependency ordering:

```
database (healthy) → backend, keycloak
backend (healthy) → frontend
keycloak (healthy) → frontend
```

## Volumes

- `database_data` — PostgreSQL data persists across container restarts

Application source is volume-mounted from the host for live development.

## Commands

```bash
task start-local              # Start all services
task start-local:build        # Start with rebuild
task stop-local               # Stop gracefully
task purge-local              # Teardown + remove volumes
task purge-and-restart-local  # Full fresh restart
task logs-local               # Follow all logs
task status                   # Show service status
```

## Environment

All services receive environment variables from the root `.env` file via `env_file` or direct `environment` blocks. Docker service names (e.g., `database`) serve as hostnames for inter-service communication.

## Migrating off Compose

If you're still on Compose and want to move to Minikube:

1. `task stop-local && task purge-local` — tear down the Compose stack
2. `task minikube:start` — start Minikube
3. `eval $(minikube docker-env)` — point Docker at Minikube's daemon
4. `task build:all` — build images into the cluster
5. `task deploy:apply` — deploy the full stack

See [Kubernetes](kubernetes.md) and [Local Workflow](../development/local-workflow.md).
