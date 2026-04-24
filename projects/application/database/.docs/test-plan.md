# Database — Test Plan

Scope: verify the PostgreSQL server delivered by the `postgres` compose service.
Schema-level tests for consumers (backend tables, Keycloak tables) live in those
projects.

## Contract Tests

- [ ] `docker compose -f infrastructure/compose/dev/compose.yml config` shows a single
      `postgres` service with a `postgres-data` named volume and no other database-
      related resources (`infrastructure/compose/dev/compose.yml`).
- [ ] Container image is `pgvector/pgvector:pg16`
      (`infrastructure/compose/dev/compose.yml` · `services.postgres.image`).
- [ ] Container exposes port `5432` on the compose network and does **not** publish it
      to the host (`services.postgres` has no `ports:` block).
- [ ] Container reaches `healthy` state when `pg_isready -U postgres` succeeds
      (healthcheck: 5s interval, 10 retries)
      (`services.postgres.healthcheck`).
- [ ] `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` arrive from the project `.env`
      file via `${...}` interpolation on `services.postgres.environment`.
- [ ] Named volume (`postgres-data` — persists across `task dev:down`; wiped by
      `task dev:down:clean`) is mounted at `/var/lib/postgresql/data`
      (`services.postgres.volumes`, `volumes.postgres-data`).

## Behavior Tests

- [ ] Psql login with configured `POSTGRES_USER` / `POSTGRES_PASSWORD` succeeds against
      `postgres:5432` from another service on the compose network (e.g. the `backend`
      container).
- [ ] `vector` extension is available (backend migration runs on first backend boot and
      enables it); `SELECT '[1,2,3]'::vector` succeeds after backend startup.
- [ ] `uuid-ossp` extension is available after backend migration;
      `SELECT uuid_generate_v4()` returns a UUID.
- [ ] Data written to any table persists across `task dev:down && task dev:up` (named
      volume retained).
- [ ] Data written to any table does **not** survive `task dev:down:clean && task dev:up`
      (named volume removed).
- [ ] The `postgres` service is not reachable from the host on port 5432 — only from
      other services on the compose network via DNS name `postgres`.

## E2E Scenarios

- [ ] Full dev stack: `task dev:up` starts `postgres`, then `backend` (waiting on
      `depends_on: postgres: condition: service_healthy`) runs its TypeORM migrations
      and creates `example_schema` + extensions.
- [ ] Keycloak: the `keycloak` service (also `depends_on: postgres`) starts, connects
      using `KC_DB_URL_HOST=postgres`, and Liquibase populates the `keycloak` schema on
      first run
      (`infrastructure/compose/dev/compose.yml` · `services.keycloak.environment`).
- [ ] Volume persistence: write a test row, run
      `docker compose -f infrastructure/compose/dev/compose.yml restart postgres`, row
      is still present after the container comes back healthy.
- [ ] Down/up persistence: write a test row, `task dev:down && task dev:up`, row is
      still present.
- [ ] Clean teardown: write a test row, `task dev:down:clean && task dev:up`, row is
      gone (volume was removed).

## Verification Commands

```bash
# Healthcheck from outside the container
docker compose -f infrastructure/compose/dev/compose.yml exec postgres \
  pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"

# Extensions (after backend migration has run)
docker compose -f infrastructure/compose/dev/compose.yml exec postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "SELECT extname FROM pg_extension WHERE extname IN ('uuid-ossp','vector');"

# Schemas (expect: public, example_schema, keycloak once both services are up)
docker compose -f infrastructure/compose/dev/compose.yml exec postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('example_schema','keycloak');"

# Vector works
docker compose -f infrastructure/compose/dev/compose.yml exec postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "SELECT '[1,2,3]'::vector;"
```
