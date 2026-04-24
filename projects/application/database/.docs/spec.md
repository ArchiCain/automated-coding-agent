# Database — Spec

## What it is

A single shared Postgres 16 server (with the `pgvector` extension) run as the `postgres` compose service. It is the one database behind the `application` stack: the backend connects to it for app data and Keycloak connects to it for its own schema. The compose service ships only the server — schemas, tables, and migrations are owned by the services that use it.

## How it behaves

### The database server

The `postgres` compose service runs a single Postgres 16 container from the `pgvector/pgvector:pg16` image, reachable on port 5432 over the compose project's default network under the DNS name `postgres`. Nothing outside the compose network can reach it directly — port 5432 is not published to the host in dev. The container is marked healthy once `pg_isready -U postgres` succeeds; the healthcheck runs every 5 seconds with up to 10 retries. Other services use `depends_on: postgres: condition: service_healthy` to block startup until the database is ready.

### Credentials

`POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` are set directly on the `postgres` service's `environment` block with `${...}` interpolation from the project `.env` file. Defaults in `.env.template` are `postgres` / `postgres` / `app`. The backend reads the same values as `DATABASE_USERNAME`, `DATABASE_PASSWORD`, and `DATABASE_NAME`; Keycloak reads them as `KC_DB_USERNAME`, `KC_DB_PASSWORD`, and `KC_DB_URL_DATABASE`. All three are wired from the same `.env` entries in `infrastructure/compose/dev/compose.yml`.

### Persistence

The `postgres` service mounts a named volume `postgres-data` at `/var/lib/postgresql/data`. Compose auto-namespaces the volume per project: `dev_postgres-data` for the long-lived dev stack (created on first `task dev:up`), `env-{id}_postgres-data` for each sandbox. Data persists across `task dev:down` and container restarts, and is wiped by `task dev:down:clean` (which removes the volume). Sandboxes get their own isolated volumes and can be torn down cleanly.

### Schema ownership (informational)

The compose service does not create schemas or extensions. The backend's TypeORM initial migration creates the `uuid-ossp` and `vector` extensions and its application schema on first boot. Keycloak creates its own `keycloak` schema via Liquibase when it starts. The `public` schema is untouched.

## Acceptance criteria

- [ ] `task dev:up` starts a Postgres 16 container (`pgvector/pgvector:pg16`) reachable on port 5432 from other services on the compose network.
- [ ] The `postgres` service does not publish port 5432 to the host.
- [ ] `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` reach the container from the project `.env` file via `${...}` interpolation.
- [ ] The container becomes healthy only after `pg_isready -U postgres` succeeds (5s interval, up to 10 retries).
- [ ] The named volume `postgres-data` is mounted at `/var/lib/postgresql/data` and data survives `task dev:down && task dev:up`.
- [ ] `task dev:down:clean` removes the volume so the next `task dev:up` starts with an empty database.
- [ ] The backend reaches the database at host `postgres` on port 5432 and its migrations create the `uuid-ossp` and `vector` extensions plus its application schema on first boot.
- [ ] Keycloak reaches the database over JDBC at host `postgres` and Liquibase creates the `keycloak` schema on first boot.

## Code map

Paths are relative to the repo root.

| Concern | File · key |
|---|---|
| Postgres service definition, image, env, healthcheck, volume mount | `infrastructure/compose/dev/compose.yml` · `services.postgres` |
| Named volume for database data | `infrastructure/compose/dev/compose.yml` · `volumes.postgres-data` |
| Backend `DATABASE_*` environment wiring | `infrastructure/compose/dev/compose.yml` · `services.backend.environment` |
| Keycloak `KC_DB_*` environment wiring | `infrastructure/compose/dev/compose.yml` · `services.keycloak.environment` |
| Sandbox overlay of the same stack (parameterized by `${SANDBOX_ID}`) | `infrastructure/compose/sandbox/compose.yml` |
| Prod overlay (GHCR image refs behind Caddy) | `infrastructure/compose/dev/compose.prod.yml` |
| Credential defaults | `.env.template` |
| Backend initial migration (creates extensions + app schema) | `projects/application/backend/app/src/features/typeorm-database-client/migrations/1734056400000-InitialSchema.ts:19-21` |
