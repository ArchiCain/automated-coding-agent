# Database

PostgreSQL database service with pgvector extension for vector similarity search.

## Overview

This project provides the physical database infrastructure only. It does **not** manage schemas, tables, or migrations — each consuming service owns its own schema.

```
postgres (database)
├── public          # Shared (use sparingly)
├── backend         # Backend service schema (managed by TypeORM)
├── keycloak        # Keycloak schema (managed by Liquibase)
└── [service_name]  # Each service gets its own schema
```

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_HOST` | Docker service name | `database` |
| `DATABASE_HOST_LOCAL` | For host-side tests | `localhost` |
| `DATABASE_PORT` | Exposed port | `5437` |
| `DATABASE_USERNAME` | PostgreSQL user | `postgres` |
| `DATABASE_PASSWORD` | PostgreSQL password | `postgres` |
| `DATABASE_NAME` | Database name | `postgres` |
| `DATABASE_SSL` | Enable SSL | `false` |

## Common tasks

```bash
task database:local:start     # Start PostgreSQL
task database:local:stop      # Stop
task database:local:shell     # psql shell
task database:local:logs      # View logs
task database:local:health    # Check health
task database:local:backup    # Timestamped backup
task database:local:reset     # Delete all data (destructive)
```

## Health checks

PostgreSQL health is checked via `pg_isready` every 5 seconds with 5 retries. Other services (backend, keycloak) depend on the database being healthy before starting.

## Image

Uses `pgvector/pgvector:pg16` — PostgreSQL 16 with the pgvector extension for vector similarity search and ML workloads.
