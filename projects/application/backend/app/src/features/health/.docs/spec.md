# Health — Spec

## What it is

Two endpoints under `/health`:

- `GET /health` — a public, dependency-free liveness check. Always returns `200` with `{ status, timestamp, service }`. Used by local smoke checks, the EC2 reverse proxy's upstream checks, and any external monitor.
- `GET /health/database` — an authenticated diagnostic that reports whether the backend's TypeORM `DataSource` can talk to Postgres right now, and lists the tables in the current schema. Used by the frontend's Testing Tools page.

## How it behaves

### Answering a health check — `GET /health`

Anyone can call `GET /health` without signing in, without a cookie, and without an authorization header. The endpoint always responds immediately with HTTP 200 and a small JSON body containing a status of `"ok"`, the current time as an ISO 8601 timestamp, and the service name `"backend"`. There is no failure branch — if the process is running well enough to answer the request, it answers with 200.

### Checking the database — `GET /health/database`

An authenticated caller (access-token cookie, same as every other `/api/*` route other than `/health` and the login endpoints) gets back a JSON body:

- `{ connected: true, tables: string[] }` when the TypeORM `DataSource` is initialized and a simple `SELECT tablename FROM pg_tables WHERE schemaname = current_schema()` returns. `tables` is sorted alphabetically.
- `{ connected: false, error: string }` when the `DataSource` isn't initialized, or when the query throws (connection reset, auth error, etc.). The `error` string is the `Error.message` from the failure, verbatim.

An unauthenticated caller gets HTTP `401` from the global `KeycloakJwtGuard` before the handler runs.

The endpoint **does not** cache. Each call runs the query against Postgres.

### What the checks do and do not cover

- `/health` only confirms that the HTTP listener is accepting and handling requests. No downstream probing.
- `/health/database` probes the TypeORM connection. It does not probe Keycloak, the agent runtime, or anything else. An outage in those systems will not cause `/health/database` to fail.

### How the endpoints are used

- **Local smoke:** `task backend:local:health` curls `/health`. A developer hitting the Testing Tools page at `/smoke-tests` or the home page at `/home` triggers a `/health/database` request from the frontend (`TypeormDatabaseClientComponent`).
- **Production (EC2, behind Caddy):** Caddy reverse-proxies the same paths. Operators can curl `/health` without auth. `/health/database` is only reachable after a Keycloak login.

## Acceptance criteria

### `GET /health`

- [ ] Returns HTTP 200 with no credentials supplied.
- [ ] Response body is a JSON object with exactly the keys `status`, `timestamp`, and `service`.
- [ ] `status` equals the literal string `"ok"`.
- [ ] `service` equals the literal string `"backend"`.
- [ ] `timestamp` is a valid ISO 8601 string parseable into a valid date.
- [ ] `timestamp` reflects the time of the current request (non-decreasing across sequential calls).
- [ ] Response `Content-Type` header is `application/json`.
- [ ] A dependency outage (database, auth provider, etc.) does not cause `/health` to fail.

### `GET /health/database`

- [ ] Returns HTTP 401 when called without an `access_token` cookie (global `KeycloakJwtGuard` rejects).
- [ ] Returns HTTP 200 with `{ connected: true, tables: string[] }` when authenticated and the `DataSource` is initialized.
- [ ] `tables` is the list of tablenames from `pg_tables` filtered to `current_schema()`, sorted ascending.
- [ ] Returns HTTP 200 with `{ connected: false, error: string }` when the `DataSource` is not initialized, or when the probe query throws.
- [ ] The `error` string, when present, is the underlying `Error.message`.
- [ ] Response `Content-Type` header is `application/json` in all success / soft-error cases.

## Known gaps

- The endpoint uses `current_schema()` — it only lists tables in whatever schema the TypeORM connection is using (typically `public`). Keycloak's own `keycloak` schema is not listed. That's by design — consumers want to see the application's own tables.
- The database probe does not currently surface row counts, table sizes, or migration status. If a caller needs those, extend the handler.

## Code map

Paths are relative to `projects/application/backend/app/`.

| Concern | File · lines |
|---|---|
| Route `GET /health` | `src/features/health/controllers/health.controller.ts:12-20` |
| Route `GET /health/database` | `src/features/health/controllers/health.controller.ts:22-43` |
| Public opt-out from `KeycloakJwtGuard` on `/health` only (not class-level) | `src/features/health/controllers/health.controller.ts:11-12` |
| Guard that honors `@Public()` via the `"isPublic"` metadata key | `src/features/keycloak-auth/guards/keycloak-jwt.guard.ts` |
| `DataSource` injection via `@InjectDataSource()` | `src/features/health/controllers/health.controller.ts:8` |
| Query against `pg_tables` filtered to `current_schema()` | `src/features/health/controllers/health.controller.ts:32-34` |
| `HealthModule` registers `HealthController`; no providers, no imports | `src/features/health/health.module.ts` |
| `HealthModule` wired into `AppModule` | `src/app.module.ts` |
| Unit test (pure controller invocation with mocked `DataSource`) | `src/features/health/controllers/health.controller.spec.ts` |
| Integration test (`supertest` against running stack, incl. authenticated `/health/database`) | `test/integration/health.integration.spec.ts` |

### Consumers

| Consumer | File · lines | Notes |
|---|---|---|
| Backend local smoke (`/health`) | `projects/application/backend/Taskfile.yml` | `curl -f http://localhost:${BACKEND_PORT}/health`. |
| Frontend Testing Tools database card (`/health/database`) | `projects/application/frontend/app/src/app/features/testing-tools/services/testing-tools.api.ts:40-45` | Sent with `withCredentials: true`. |
| Home-page database status card (`/health/database`) | `projects/application/frontend/app/src/app/features/home/...` | Same `TestingToolsApiService.checkDatabase` call. |
| Future EC2 reverse proxy upstream probe | `infrastructure/caddy/Caddyfile` | Not wired today; Caddy uses transport-level checks, not HTTP probes, unless explicitly configured. |
