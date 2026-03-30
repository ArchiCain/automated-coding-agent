# Docker Compose

The local development stack is defined in `infrastructure/docker/compose.yml`. It runs all services with hot reload and volume mounts.

## Services

| Service | Image | Port | Notes |
|---------|-------|------|-------|
| database | Custom (pgvector) | 5437 | Persistent volume, health check via `pg_isready` |
| pgweb | `sosedoff/pgweb` | 8082 | Database web UI |
| backend | Custom (NestJS) | 8085 | Volume-mounted source, hot reload |
| keycloak | Custom | 8081 | Realm auto-import, shared DB |
| frontend | Custom (React/Vite) | 3000 | Volume-mounted source, hot reload |
| coding-agent-backend | Custom (NestJS) | 8086 | Mounts repo root as `/workspace` |
| coding-agent-frontend | Custom (Angular/nginx) | 3001 | Custom nginx config for API proxy |
| openclaw-gateway | Custom (Nix/OpenClaw) | 18789 | Mounts repo root as `/workspace`, includes Playwright |
| docs | Custom (MkDocs) | 8083 | Volume-mounted source, live reload |

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
coding-agent-backend (healthy) → coding-agent-frontend
backend + frontend + keycloak (healthy) → openclaw-gateway
```

## Volumes

- `database_data` — PostgreSQL data persists across container restarts

Application source is volume-mounted from the host for live development:

```yaml
volumes:
  - ../../projects/backend/app:/app        # Source code
```

## Commands

```bash
task start-local            # Start all services
task start-local:build      # Start with rebuild
task stop-local             # Stop gracefully
task purge-local            # Teardown + remove volumes
task purge-and-restart-local # Full fresh restart
task logs-local             # Follow all logs
task status                 # Show service status
```

## Environment

All services receive environment variables from the root `.env` file via `env_file` or direct `environment` blocks. Docker service names (e.g., `database`) serve as hostnames for inter-service communication.
