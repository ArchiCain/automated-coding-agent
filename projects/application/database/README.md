# Database

PostgreSQL database infrastructure with pgvector extension for vector similarity search.

## Project Structure

```
projects/application/database/
├── dockerfiles/
│   └── postgres.Dockerfile    # pgvector/pgvector:pg16
├── chart/
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/
│       ├── statefulset.yaml   # Single-replica StatefulSet
│       ├── service.yaml       # ClusterIP on port 5432
│       └── secret.yaml        # Database credentials
└── Taskfile.yml
```

## Schema Ownership

This project provides the physical PostgreSQL database only. Each consuming service manages its own schema:

| Schema | Owner | Migration Tool |
|--------|-------|---------------|
| `public` | Shared (use sparingly) | — |
| Backend app schema | Backend service | TypeORM migrations |
| `keycloak` | Keycloak service | Liquibase (auto) |

## Tasks

```bash
task database:local:start     # Start PostgreSQL
task database:local:stop      # Stop
task database:local:shell     # psql shell
task database:local:logs      # View logs
task database:local:health    # Check health (pg_isready)
task database:local:backup    # Timestamped pg_dump
task database:local:reset     # Delete all data (destructive)
```

PGWeb database UI:
```bash
task database:pgweb:start     # Start pgweb UI (port 8082)
task database:pgweb:stop
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_HOST` | `database` | Docker service name |
| `DATABASE_HOST_LOCAL` | `localhost` | For host-side tests |
| `DATABASE_PORT` | `5437` | Exposed port |
| `DATABASE_USERNAME` | `postgres` | PostgreSQL user |
| `DATABASE_PASSWORD` | `postgres` | PostgreSQL password |
| `DATABASE_NAME` | `postgres` | Database name |

## K8s Deployment

Deployed as a StatefulSet with persistent storage. Health checks via `pg_isready` (10s initial delay, 5s interval). Default resources: 256Mi-512Mi memory, 100m-500m CPU.
