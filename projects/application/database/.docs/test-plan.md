# Database — Test Plan

## Contract Tests

- [ ] PostgreSQL 16 container starts and accepts connections on port 5432
- [ ] `pg_isready` liveness probe returns success within `initialDelaySeconds` (10s)
- [ ] `uuid-ossp` extension is installed and functional (`SELECT uuid_generate_v4()` returns a UUID)
- [ ] `vector` extension (pgvector) is installed (`SELECT '[]'::vector` does not error)
- [ ] Database accepts connections with configured credentials (`DATABASE_USERNAME`/`DATABASE_PASSWORD`)

## Behavior Tests

- [ ] `example_schema` schema exists and contains `examples` table with columns: id (UUID PK), name (VARCHAR 255), description (TEXT), metadata (JSONB), created_at, updated_at, deleted_at
- [ ] `example_schema` contains `user_theme` table with columns: id (UUID PK), user_id (VARCHAR, unique), theme (VARCHAR 10, default 'dark'), created_at, updated_at
- [ ] `keycloak` schema exists (created by startup script or Keycloak Liquibase)
- [ ] `mastra` schema exists (created by Mastra service)
- [ ] GIN index exists on `examples.metadata` column
- [ ] Index exists on `examples.name` column
- [ ] Data persists across pod restart (write row, delete pod, verify row exists after restart)
- [ ] No external ingress — service is ClusterIP only, not reachable outside cluster

## E2E Scenarios

- [ ] Full startup: deploy StatefulSet, wait for readiness probe, connect with psql, verify extensions and schemas
- [ ] Migration verification: deploy backend service, verify TypeORM creates/updates `example_schema` tables
- [ ] PVC persistence: insert test row into `examples`, delete the pod, wait for reschedule, query and verify test row still exists
- [ ] PGWeb access (when enabled): navigate to pgweb ingress URL, verify web UI renders and can list tables
- [ ] Resource limits: verify pod runs within 256Mi-512Mi memory and 100m-500m CPU bounds

## Verification Commands

```bash
# Check PostgreSQL is ready
pg_isready -h localhost -p 5432

# Check extensions
psql -U postgres -c "SELECT extname FROM pg_extension WHERE extname IN ('uuid-ossp', 'vector');"

# Check schemas
psql -U postgres -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('example_schema', 'keycloak', 'mastra');"

# Check tables
psql -U postgres -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'example_schema';"

# Verify pgvector works
psql -U postgres -c "SELECT '[1,2,3]'::vector;"
```
