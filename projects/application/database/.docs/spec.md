# Database — Spec

## What it is

A single shared Postgres 16 server (with the `pgvector` extension) packaged as a Helm chart and deployed into the cluster. It is the one database behind the `application` stack: the backend connects to it for app data and Keycloak connects to it for its own schema. The chart ships only the server — schemas, tables, and migrations are owned by the services that use it.

## How it behaves

### The database server

The chart runs a single Postgres 16 pod from the `pgvector/pgvector:pg16` image, reachable on port 5432 inside the cluster under the Helm release name. Nothing outside the cluster can reach it directly — there is no Ingress on the database itself. The pod is marked healthy once `pg_isready` against the configured user and database succeeds; the liveness check waits 10 seconds before its first run, the readiness check waits 5, and both re-run every 5 seconds. Default resource footprint is 256Mi / 100m CPU requested and 512Mi / 500m CPU capped.

### Credentials

The database user, password, and database name are passed in as Helm values. When they are set, the chart materializes them into a Kubernetes Secret named after the release and loads them into the Postgres container as environment variables (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`). In the cluster deployment these come from `DATABASE_USERNAME`, `DATABASE_PASSWORD`, and `DATABASE_NAME` in the Helmfile environment.

### Persistence

By default the database claims a 10Gi persistent volume (ReadWriteOnce) from the cluster's default storage class and mounts it at `/var/lib/postgresql/data` under a `pgdata` subdirectory, so data survives pod restarts. Size and storage class are overridable. Setting `persistence.enabled=false` skips the volume entirely — useful for sandbox tests where data does not need to stick around.

### pgweb admin UI (optional)

When `pgweb.enabled` is on, the chart also ships a `sosedoff/pgweb` web UI on port 8081 that connects to the same Postgres instance using the chart's credentials. A Traefik Ingress routes to it on a configurable host (default `db.${DEV_HOSTNAME}` from the Helmfile), optionally over TLS. pgweb is off by default in the chart but the Helmfile turns it on for the live deployment.

### Schema ownership (informational)

The chart does not create schemas or extensions. The backend's TypeORM initial migration creates the `uuid-ossp` and `vector` extensions and its application schema on first boot. Keycloak creates its own `keycloak` schema via Liquibase when it starts. The `public` schema is untouched.

## Acceptance criteria

- [ ] Helm install renders a Postgres 16 pod (`pgvector/pgvector:pg16`) reachable on port 5432 inside the cluster.
- [ ] The database Service is ClusterIP-only (not exposed via Ingress).
- [ ] `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` from Helm values reach the container through the release's Secret.
- [ ] The pod becomes Ready only after `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB` succeeds.
- [ ] With persistence enabled, a 10Gi (or configured size) volume is mounted at `/var/lib/postgresql/data` and data survives a pod restart.
- [ ] With `persistence.enabled=false`, no volume is created and data is ephemeral.
- [ ] With `pgweb.enabled=true`, the pgweb UI is deployed on port 8081 and (when its Ingress is enabled) reachable via Traefik at the configured host.
- [ ] The backend reaches the database at host `database` on port 5432 and its migrations create the `uuid-ossp` and `vector` extensions plus its application schema on first boot.
- [ ] Keycloak reaches the database over JDBC and Liquibase creates the `keycloak` schema on first boot.

## Known gaps

- The local Taskfile (`Taskfile.yml`) drives everything through `docker compose -f infrastructure/docker/compose.yml`, but that compose file does not exist in the repo — none of the `local:*` or `pgweb:*` tasks will run as written.
- `dockerfiles/postgres.Dockerfile` contains Jinja-style placeholders (`{{DATABASE_NAME}}`, `{{MASTER_USERNAME}}`) that nothing in the repo substitutes, and the Helm chart does not reference this Dockerfile — it pulls `pgvector/pgvector:pg16` directly. The Dockerfile is effectively dead code.
- The README lists `DATABASE_PORT=5437`, but every live config (chart values, Service, Helmfile, backend) uses 5432. The README value is stale.

## Code map

Paths are relative to the repo root.

| Concern | File · lines |
|---|---|
| Postgres pod definition, health probes, volume mount | `projects/application/database/chart/templates/statefulset.yaml:1-65` |
| Internal ClusterIP endpoint on port 5432 | `projects/application/database/chart/templates/service.yaml:1-15` |
| Credentials Secret (created only when `env` is set) | `projects/application/database/chart/templates/secret.yaml:1-13` |
| Persistent volume claim template (10Gi default, RWO) | `projects/application/database/chart/templates/statefulset.yaml:47-65` |
| Chart defaults (image, persistence, resources, probes, pgweb) | `projects/application/database/chart/values.yaml:1-45` |
| pgweb UI container and DB connection URL | `projects/application/database/chart/templates/pgweb-deployment.yaml:1-37` |
| pgweb internal Service on port 8081 | `projects/application/database/chart/templates/pgweb-service.yaml:1-16` |
| pgweb Traefik Ingress (optional TLS) | `projects/application/database/chart/templates/pgweb-ingress.yaml:1-31` |
| Live release wiring: image, credentials, persistence, pgweb host | `infrastructure/k8s/helmfile.yaml.gotmpl:95-122` |
| Backend initial migration (creates extensions + app schema) | `projects/application/backend/app/src/features/typeorm-database-client/migrations/1734056400000-InitialSchema.ts:19-21` |
| Keycloak schema wiring (`KC_DB_SCHEMA=keycloak`) | `infrastructure/k8s/helmfile.yaml.gotmpl:180` |
| Local dev tasks (reference a missing compose file) | `projects/application/database/Taskfile.yml:1-93` |
| Unused Dockerfile with unsubstituted placeholders | `projects/application/database/dockerfiles/postgres.Dockerfile:1-12` |
| README with stale port `5437` | `projects/application/database/README.md:49-58` |
