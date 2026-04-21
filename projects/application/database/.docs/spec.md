# Database — Spec

## Purpose

Provide a single shared PostgreSQL 16 instance (with `pgvector`) for the `application`
stack. This project packages the server: an image reference and a Helm chart that
deploys a single-replica StatefulSet with a persistent volume, internal ClusterIP
Service, and an optional pgweb admin UI. Schema creation and migrations are the
responsibility of the consuming services, not this chart.

## Behavior

- Runs `pgvector/pgvector:pg16` in a StatefulSet named after the Helm release, with
  one replica and an attached PVC mounted at `/var/lib/postgresql/data` (`subPath:
  pgdata`) (`projects/application/database/chart/templates/statefulset.yaml:19-52`).
- Exposes port `5432` via a ClusterIP `Service` named after the release
  (`projects/application/database/chart/templates/service.yaml`). No Ingress is
  attached to the database Service itself — it is reachable only from inside the
  cluster.
- Credentials and database name are sourced from Helm values under `.Values.env` and
  materialized into a Kubernetes `Secret` named `{release}-secret`; the StatefulSet
  consumes it via `envFrom.secretRef`
  (`projects/application/database/chart/templates/secret.yaml`,
  `projects/application/database/chart/templates/statefulset.yaml:24-28`). Expected
  keys: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
  (`infrastructure/k8s/helmfile.yaml.gotmpl:103-106`).
- Persistence is on by default: `volumeClaimTemplates` requests `10Gi`
  `ReadWriteOnce`, optional `storageClass` override. Setting
  `persistence.enabled=false` skips the PVC (ephemeral, used for sandbox tests)
  (`projects/application/database/chart/values.yaml:11-14`,
  `projects/application/database/chart/templates/statefulset.yaml:47-65`).
- Liveness and readiness probes both run
  `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB`. Liveness starts after 10s, period
  5s; readiness starts after 5s, period 5s
  (`projects/application/database/chart/templates/statefulset.yaml:29-44`).
- Default resources: requests 256Mi / 100m, limits 512Mi / 500m
  (`projects/application/database/chart/values.yaml:16-22`).
- Optional pgweb UI (`pgweb.enabled=true`) deploys `sosedoff/pgweb` on container port
  `8081`, connects with `PGWEB_DATABASE_URL=postgres://$USER:$PASSWORD@{release}:5432/$DB?sslmode=disable`,
  and is exposed via a Traefik Ingress on `pgweb.ingress.host` (TLS optional)
  (`projects/application/database/chart/templates/pgweb-deployment.yaml`,
  `projects/application/database/chart/templates/pgweb-ingress.yaml`).

## Components

| Resource | Kind | Purpose |
|---|---|---|
| `{release}` | StatefulSet | Postgres 16 pod with PVC at `/var/lib/postgresql/data` (`.../statefulset.yaml`) |
| `{release}` | Service (ClusterIP) | Internal DB endpoint on port 5432 (`.../service.yaml`) |
| `{release}-secret` | Secret | Holds `POSTGRES_USER/PASSWORD/DB` when `.Values.env` is set (`.../secret.yaml`) |
| `{release}-pgweb` | Deployment | pgweb UI container, port 8081 (`.../pgweb-deployment.yaml`) |
| `{release}-pgweb` | Service (ClusterIP) | UI Service on port 8081 (`.../pgweb-service.yaml`) |
| `{release}-pgweb` | Ingress (Traefik) | Optional TLS/non-TLS routing to pgweb (`.../pgweb-ingress.yaml`) |

## Configuration (Helm values)

| Key | Default | Source |
|---|---|---|
| `image.repository` | `pgvector/pgvector` | `values.yaml:1-4` |
| `image.tag` | `pg16` | `values.yaml:1-4` |
| `service.port` | `5432` | `values.yaml:6-7` |
| `env.POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | unset; supplied by Helmfile | `values.yaml:9`, `helmfile.yaml.gotmpl:103-106` |
| `persistence.enabled` | `true` | `values.yaml:11-14` |
| `persistence.size` | `10Gi` | `values.yaml:11-14` |
| `persistence.storageClass` | `""` (cluster default) | `values.yaml:11-14` |
| `resources.requests/limits` | 256Mi/100m — 512Mi/500m | `values.yaml:16-22` |
| `healthCheck.initialDelaySeconds` | `10` | `values.yaml:24-26` |
| `healthCheck.periodSeconds` | `5` | `values.yaml:24-26` |
| `pgweb.enabled` | `false` (chart); `true` (Helmfile) | `values.yaml:28-29`, `helmfile.yaml.gotmpl:117-122` |
| `pgweb.ingress.host` | `db.${DEV_HOSTNAME}` | `helmfile.yaml.gotmpl:121` |

## Schema Ownership (informational — not created by this chart)

| Schema | Owner | Created By |
|---|---|---|
| `example_schema` | Backend (NestJS/TypeORM) | `projects/application/backend/app/src/features/typeorm-database-client/migrations/1734056400000-InitialSchema.ts` |
| `keycloak` | Keycloak | Liquibase on Keycloak startup (`KC_DB_SCHEMA=keycloak`, `infrastructure/k8s/helmfile.yaml.gotmpl:180`) |
| `public` | — | Default; not used by app code |

`uuid-ossp` and `vector` extensions are created by the backend's initial migration,
not by this chart (`...1734056400000-InitialSchema.ts:19-21`).

## Acceptance Criteria

- [ ] Helm install renders a StatefulSet running `pgvector/pgvector:pg16` with a
      10Gi PVC (or the configured size) mounted at `/var/lib/postgresql/data`.
- [ ] `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` from Helmfile reach the
      container via `{release}-secret` → `envFrom`.
- [ ] Pod becomes Ready once `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB` succeeds.
- [ ] Service `{release}` resolves to the pod on port 5432, ClusterIP-only.
- [ ] Data persists across pod restart when `persistence.enabled=true`.
- [ ] When `persistence.enabled=false`, no PVC is created and data is ephemeral.
- [ ] When `pgweb.enabled=true`, pgweb Deployment/Service are created, and Ingress is
      created when `pgweb.ingress.enabled=true`, routed via Traefik to port 8081.
- [ ] Backend connects using `DATABASE_HOST=database`, port 5432, and its migrations
      succeed (extensions + `example_schema` created on first boot).
- [ ] Keycloak connects via JDBC and Liquibase creates the `keycloak` schema.
