# Database — Test Plan

Scope: verify the PostgreSQL server delivered by this chart. Schema-level tests for
consumers (backend tables, Keycloak tables) live in those projects.

## Contract Tests

- [ ] Helm renders a StatefulSet, Service, and (when `.Values.env` set) Secret named
      after the release, with no other resources unless pgweb is enabled
      (`projects/application/database/chart/templates/`).
- [ ] Pod image is `pgvector/pgvector:pg16` (or whatever `DATABASE_IMAGE[_TAG]`
      overrides to) (`infrastructure/k8s/helmfile.yaml.gotmpl:100-102`).
- [ ] Container exposes port `5432`, Service is `ClusterIP`, no Ingress
      (`.../statefulset.yaml:22-23`, `.../service.yaml`).
- [ ] Pod reaches `Ready` when `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB`
      succeeds (readiness probe, initial delay 5s, period 5s)
      (`.../statefulset.yaml:37-44`).
- [ ] `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` arrive via
      `{release}-secret` → `envFrom` (`.../statefulset.yaml:24-28`,
      `.../secret.yaml`).
- [ ] PVC is created when `persistence.enabled=true` (default) with
      `accessModes: [ReadWriteOnce]` and the configured size; no PVC when disabled
      (`.../statefulset.yaml:47-65`).

## Behavior Tests

- [ ] Psql login with configured `POSTGRES_USER` / `POSTGRES_PASSWORD` succeeds
      against the `{release}` Service from within the cluster.
- [ ] `vector` extension is available (backend migration runs on first backend boot
      and enables it); `SELECT '[1,2,3]'::vector` succeeds after backend startup.
- [ ] `uuid-ossp` extension is available after backend migration;
      `SELECT uuid_generate_v4()` returns a UUID.
- [ ] Data written to any table persists across a pod delete/reschedule when
      persistence is enabled.
- [ ] When `persistence.enabled=false`, tables created in a previous pod do NOT
      survive a pod replacement.
- [ ] Database Service is not reachable via Ingress / external DNS — only via its
      in-cluster DNS name (`{release}.{namespace}.svc.cluster.local`).

## E2E Scenarios

- [ ] Full deploy: `task k8s:deploy` or Helmfile apply provisions the `database`
      release, backend release waits on it (`needs: database`,
      `infrastructure/k8s/helmfile.yaml.gotmpl:127-128`), backend's TypeORM
      migrations run and create `example_schema` + extensions.
- [ ] Keycloak deploy: Keycloak (`needs: database`) starts, connects via
      `jdbc:postgresql://database:5432/postgres`, Liquibase populates the `keycloak`
      schema on first run (`infrastructure/k8s/helmfile.yaml.gotmpl:164-191`).
- [ ] pgweb UI (when `pgweb.enabled=true`): Ingress host `db.${DEV_HOSTNAME}`
      serves the pgweb UI over Traefik; pgweb can list `public`, `example_schema`,
      and `keycloak`.
- [ ] PVC persistence: write a test row, `kubectl delete pod {release}-0`, wait for
      reschedule, row is still present.
- [ ] Resource bounds: pod runs within its configured `requests`/`limits`
      (256Mi/100m – 512Mi/500m by default).

## Verification Commands

```bash
# From inside the cluster (kubectl exec into the pod)
kubectl -n app exec -it database-0 -- pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"

# Extensions (after backend migration has run)
kubectl -n app exec -it database-0 -- psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "SELECT extname FROM pg_extension WHERE extname IN ('uuid-ossp','vector');"

# Schemas (expect: public, example_schema, keycloak once both services are up)
kubectl -n app exec -it database-0 -- psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('example_schema','keycloak');"

# Vector works
kubectl -n app exec -it database-0 -- psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "SELECT '[1,2,3]'::vector;"
```
