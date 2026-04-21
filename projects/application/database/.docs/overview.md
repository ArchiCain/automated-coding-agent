# Database — Overview

## What This Is

The shared PostgreSQL instance for the `application` stack. Packaged as a Helm chart
plus a Dockerfile, deployed as a single-replica StatefulSet under the `app` namespace.
Backend (NestJS/TypeORM), Keycloak, and the optional pgweb UI all connect to this one
database. Each consumer owns its own schema — this project provides the server, not the
schemas (`projects/application/database/chart/templates/statefulset.yaml`).

## Tech Stack

- **Image:** `pgvector/pgvector:pg16` — Postgres 16 with the `vector` extension available
  (`projects/application/database/chart/values.yaml:1-4`, `projects/application/database/dockerfiles/postgres.Dockerfile:1`).
- **Chart:** Local Helm chart v0.1.0, `appVersion "16"`
  (`projects/application/database/chart/Chart.yaml`).
- **Orchestration:** Helmfile release `database` in namespace `app`, declared at
  `infrastructure/k8s/helmfile.yaml.gotmpl:95-123`.
- **Storage:** PVC via `volumeClaimTemplates`, `ReadWriteOnce`, default size `10Gi`,
  mounted at `/var/lib/postgresql/data` with `subPath: pgdata`
  (`projects/application/database/chart/templates/statefulset.yaml:47-65`,
  `projects/application/database/chart/values.yaml:11-14`).
- **UI (optional):** `sosedoff/pgweb:latest` Deployment + Service + Traefik Ingress,
  gated by `pgweb.enabled`
  (`projects/application/database/chart/templates/pgweb-deployment.yaml`,
  `projects/application/database/chart/templates/pgweb-ingress.yaml`). Helmfile enables
  it by default with host `db.${DEV_HOSTNAME}`.

## Consumers

| Consumer | Connects Via | Schema | Migration Tool |
|----------|-------------|--------|----------------|
| Backend (NestJS) | `DATABASE_HOST=database` on port `5432` (`infrastructure/k8s/helmfile.yaml.gotmpl:142-146`) | `example_schema` | TypeORM migrations (`projects/application/backend/app/src/features/typeorm-database-client/migrations/`) |
| Keycloak | `KC_DB_URL=jdbc:postgresql://database:5432/postgres` (`infrastructure/k8s/helmfile.yaml.gotmpl:179-181`) | `keycloak` (`KC_DB_SCHEMA`) | Liquibase (bundled in Keycloak) |
| pgweb | `postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@{release}:5432/$POSTGRES_DB` (`projects/application/database/chart/templates/pgweb-deployment.yaml:25-26`) | — (read-only UI) | — |

All connections use the cluster-internal Service name `database` (ClusterIP, not
exposed via Ingress) (`projects/application/database/chart/templates/service.yaml`).

## Deploy Model

- **Local/dev/prod K8s:** `task k8s:deploy` runs Helmfile which renders this chart with
  values from `infrastructure/k8s/helmfile.yaml.gotmpl:95-123`. `DATABASE_PASSWORD` is a
  required env var; `DATABASE_NAME`, `DATABASE_USERNAME`, image repo/tag, volume size,
  and resource requests/limits are all overridable via env.
- **Secret material:** `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` are passed
  through `values.env` and rendered into a Kubernetes `Secret` named
  `{release}-secret`, wired into the pod via `envFrom.secretRef`
  (`projects/application/database/chart/templates/secret.yaml`,
  `projects/application/database/chart/templates/statefulset.yaml:24-28`).
- **Health:** `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB` drives both liveness
  (initialDelay 10s, period 5s) and readiness (initialDelay 5s, period 5s)
  (`projects/application/database/chart/templates/statefulset.yaml:29-44`).
- **Resources (defaults):** requests 256Mi / 100m, limits 512Mi / 500m
  (`projects/application/database/chart/values.yaml:16-22`).
- **Extensions:** `uuid-ossp` and `vector` are created by the backend's initial
  TypeORM migration, not by this chart
  (`projects/application/backend/app/src/features/typeorm-database-client/migrations/1734056400000-InitialSchema.ts:19-21`).

## Standards

Chart + image only; there is no project-level `standards/coding.md` — conventions are
inherited from the repo-level `.docs/standards/`.

## Notes / Drift

- `Taskfile.yml` targets (`local:start`, `local:shell`, etc.) invoke
  `infrastructure/docker/compose.yml`, but that file does not exist in the repo.
  The local dev path is K8s via `task k8s:deploy`, not docker-compose.
- `dockerfiles/postgres.Dockerfile` uses `{{DATABASE_NAME}}` / `{{MASTER_USERNAME}}`
  placeholders (not valid Dockerfile syntax and not referenced by anything that
  substitutes them). The Helm chart pulls `pgvector/pgvector:pg16` directly, so the
  Dockerfile is unused.
