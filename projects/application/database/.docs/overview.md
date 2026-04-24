# Database — Overview

## What This Is

The shared PostgreSQL instance for the `application` stack. Runs as the `postgres`
compose service, a single container shared by every other service in the project.
Backend (NestJS/TypeORM), Keycloak, and the optional pgweb UI all connect to this one
database. Each consumer owns its own schema — this project provides the server, not the
schemas (`infrastructure/compose/dev/compose.yml`, service `postgres`).

## Tech Stack

- **Image:** `pgvector/pgvector:pg16` — Postgres 16 with the `vector` extension available,
  used directly with no local build (`infrastructure/compose/dev/compose.yml`, service
  `postgres`).
- **Orchestration:** compose service `postgres` in the `dev` compose project (and the
  `env-{id}` compose project for sandboxes, `infrastructure/compose/sandbox/compose.yml`).
- **Storage:** named volume `postgres-data` mounted at `/var/lib/postgresql/data`. Compose
  auto-namespaces the volume per project (`dev_postgres-data` for the long-lived dev
  stack, `env-{id}_postgres-data` for sandboxes). Persists across `task dev:down`; wiped
  by `task dev:down:clean`.
- **UI (optional):** `sosedoff/pgweb:latest` — not currently wired into the compose
  stack; use `docker compose exec postgres psql` for ad hoc access.

## Consumers

| Consumer | Connects Via | Schema | Migration Tool |
|----------|-------------|--------|----------------|
| Backend (NestJS) | `DATABASE_HOST=postgres` on port `5432` (`infrastructure/compose/dev/compose.yml`, service `backend` environment) | `example_schema` | TypeORM migrations (`projects/application/backend/app/src/features/typeorm-database-client/migrations/`) |
| Keycloak | `KC_DB_URL_HOST=postgres`, `KC_DB_URL_PORT=5432` (`infrastructure/compose/dev/compose.yml`, service `keycloak` environment) | `keycloak` (`KC_DB_SCHEMA`) | Liquibase (bundled in Keycloak) |

All connections use the compose service name `postgres` on the project's default network.
Port 5432 is **not** published to the host in dev — access from the laptop is via
`docker compose -f infrastructure/compose/dev/compose.yml exec postgres psql`.

## Deploy Model

- **Dev laptop:** `task dev:up` (or `task up`) brings the stack up via
  `docker compose -f infrastructure/compose/dev/compose.yml up -d`. `POSTGRES_USER`,
  `POSTGRES_PASSWORD`, and `POSTGRES_DB` come from `.env` (defaults in `.env.template`:
  `postgres` / `postgres` / `app`).
- **EC2 / prod:** same compose files with the `compose.prod.yml` overlay (GHCR image
  refs) behind Caddy.
- **Credentials:** `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` are set directly
  on the `postgres` service `environment` block via `${...}` interpolation from `.env`
  (`infrastructure/compose/dev/compose.yml`, service `postgres`).
- **Health:** `pg_isready -U postgres` drives the healthcheck (5s interval, 10 retries).
  Other services use `depends_on: postgres: condition: service_healthy` to wait for it.
- **Extensions:** `uuid-ossp` and `vector` are created by the backend's initial TypeORM
  migration, not by the compose config
  (`projects/application/backend/app/src/features/typeorm-database-client/migrations/1734056400000-InitialSchema.ts:19-21`).

## Standards

Service definition only; there is no project-level `standards/coding.md` — conventions
are inherited from the repo-level `.docs/standards/`.
