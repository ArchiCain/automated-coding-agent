# Health — Test Plan

Backed by:
- Unit: `app/src/features/health/controllers/health.controller.spec.ts`
- Integration: `app/test/integration/health.integration.spec.ts`

## Contract tests — `GET /health`

- [ ] Returns HTTP `200`.
- [ ] `Content-Type` matches `application/json`.
- [ ] Response body has the keys `status`, `timestamp`, `service` and nothing more surprising.
- [ ] `status === "ok"`.
- [ ] `service === "backend"`.
- [ ] `timestamp` matches ISO 8601 pattern `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}` and parses to a valid `Date`.

## Behavior tests — `GET /health`

- [ ] No authentication required — request with no `access_token` cookie and no `Authorization` header still returns `200`. Verifies method-level `@Public()` opt-out.
- [ ] `timestamp` reflects "now" — it falls between the timestamps captured immediately before and after the request.
- [ ] Timestamp is regenerated per call — two sequential invocations yield `t2 >= t1`.
- [ ] Endpoint is stable under repeated load — 5 sequential requests each return `200` with `status: "ok"`.

## Contract tests — `GET /health/database`

- [ ] Returns HTTP `401` when called without an `access_token` cookie.
- [ ] Returns HTTP `200` when authenticated.
- [ ] `Content-Type` matches `application/json` on the authenticated path.
- [ ] Response body has keys `connected` (boolean) and either `tables: string[]` or `error: string` — never both.

## Behavior tests — `GET /health/database`

- [ ] On the authenticated happy path, `connected === true` and `tables` includes at least `"typeorm_migrations"` (always present because the backend runs migrations on boot).
- [ ] `tables` is ordered ascending.
- [ ] Unit test: when the mocked `DataSource` reports `isInitialized: false`, the handler returns `{ connected: false, error: "Data source not initialized" }` without issuing a query.
- [ ] Unit test: when the `DataSource.query` rejects with an `Error`, the handler returns `{ connected: false, error: <Error.message> }`.
- [ ] Unit test: when the `DataSource.query` resolves with `[{ tablename: "a" }, { tablename: "b" }]`, the handler returns `{ connected: true, tables: ["a", "b"] }`.

## E2E / Smoke

- [ ] `curl -f http://localhost:${BACKEND_PORT}/health` exits `0` against a locally running stack.
- [ ] From the Testing Tools page (`/smoke-tests`) or the home page (`/home`), clicking the "Check" button on the Database Connection card triggers a `GET /health/database` and surfaces the table list. Broken state (connected=false) surfaces the error string.

## Not in scope

- No latency SLO tests. The handler is lightweight; if it becomes slow, that's a symptom of a downstream issue the health endpoint surfaces via `connected: false`.
- No tests against Keycloak's own schema — `/health/database` intentionally queries `current_schema()` only.
- No tests for `Cache-Control`/`Expires` headers — Nest sets neither by default; clients should not cache.
