# Database — Requirements

## What This Is

PostgreSQL 16 with pgvector extension. Runs as a single-replica StatefulSet in Kubernetes with persistent storage. Each service owns its own schema.

## Schemas

| Schema | Owner | Migration Tool | Description |
|--------|-------|----------------|-------------|
| `public` | Shared | — | Discouraged for new data |
| `example_schema` | Backend (NestJS) | TypeORM | Application tables |
| `keycloak` | Keycloak | Liquibase (automatic) | IAM/auth data |
| `mastra` | Mastra | Mastra's own tool | AI/workflow data |

## Extensions

| Extension | Purpose |
|-----------|---------|
| `uuid-ossp` | UUID generation |
| `vector` | pgvector for vector similarity search |

## Tables (example_schema)

### examples

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK, auto-generated |
| name | VARCHAR(255) | Indexed |
| description | TEXT | Nullable |
| metadata | JSONB | Nullable, GIN indexed |
| created_at | TIMESTAMP | Auto |
| updated_at | TIMESTAMP | Auto |
| deleted_at | TIMESTAMP | Soft delete |

### user_theme

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK, auto-generated |
| user_id | VARCHAR | Unique constraint |
| theme | VARCHAR(10) | Default: 'dark' |
| created_at | TIMESTAMP | Auto |
| updated_at | TIMESTAMP | Auto |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_HOST` | localhost | PostgreSQL host |
| `DATABASE_PORT` | 5432 | Port |
| `DATABASE_USERNAME` | postgres | User |
| `DATABASE_PASSWORD` | postgres | Password |
| `DATABASE_NAME` | postgres | Database name |

## Kubernetes

- **StatefulSet:** Single replica, 10Gi PVC
- **Health:** `pg_isready` liveness/readiness probes
- **Resources:** 256Mi–512Mi memory, 100m–500m CPU
- **Service:** ClusterIP on port 5432 (internal only)
- **PGWeb:** Optional web UI, enabled via `pgweb.enabled: true`

## Acceptance Criteria

- [ ] pgvector extension available
- [ ] Each service schema isolated
- [ ] Data persists across pod restarts (PVC)
- [ ] No external ingress (internal access only)
