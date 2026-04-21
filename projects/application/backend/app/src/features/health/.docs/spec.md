# Health — Spec

## What it is

A lightweight, unauthenticated health endpoint at `/health` that confirms the backend process is up and serving HTTP. It is used by Kubernetes liveness and readiness probes, by local smoke checks during development, and by any external monitor that wants to know the service is alive.

## How it behaves

### Answering a health check

Anyone can call `GET /health` without signing in, without a cookie, and without an authorization header. The endpoint always responds immediately with HTTP 200 and a small JSON body containing a status of `"ok"`, the current time as an ISO 8601 timestamp, and the service name `"backend"`. There is no failure branch — if the process is running well enough to answer the request, it answers with 200.

### What the check does and does not cover

The endpoint only confirms that the backend's HTTP listener is accepting and handling requests. It does not probe the database, the auth provider, or any other dependency. An outage in a downstream system will not cause `/health` to fail.

### How it is used

Kubernetes calls `/health` on a schedule as both a liveness probe (restart the pod if it stops answering) and a readiness probe (don't send traffic to a pod that isn't answering yet). The backend's Taskfile uses the same endpoint for a local smoke check after start.

## Acceptance criteria

- [ ] `GET /health` returns HTTP 200 with no credentials supplied.
- [ ] The response body is a JSON object with exactly the keys `status`, `timestamp`, and `service`.
- [ ] `status` equals the literal string `"ok"`.
- [ ] `service` equals the literal string `"backend"`.
- [ ] `timestamp` is a valid ISO 8601 string parseable into a valid date.
- [ ] `timestamp` reflects the time of the current request (non-decreasing across sequential calls).
- [ ] The response `Content-Type` header is `application/json`.
- [ ] The endpoint works without an `access_token` cookie or `Authorization` header.
- [ ] The endpoint path `/health` matches the path configured for the Kubernetes probes — a rename must update both.
- [ ] A dependency outage (database, auth provider, etc.) does not cause `/health` to fail.

## Known gaps

None known. The endpoint has no failure branch and no dependency probing by design; if deeper checks are ever required, that would be a new scope rather than a gap against this spec.

## Code map

Paths are relative to `projects/application/backend/app/`.

| Concern | File · lines |
|---|---|
| Route `GET /health` on the main HTTP listener | `src/features/health/controllers/health.controller.ts:5-8` |
| Public opt-out from `KeycloakJwtGuard` via `@Public()` at class level | `src/features/health/controllers/health.controller.ts:1-5` |
| Guard that honors `@Public()` via the `"isPublic"` metadata key | `src/features/keycloak-auth/guards/keycloak-jwt.guard.ts` |
| Synchronous 200 response with `{ status, timestamp, service }` | `src/features/health/controllers/health.controller.ts:7-14` |
| `timestamp` generated per request via `new Date().toISOString()` | `src/features/health/controllers/health.controller.ts:11` |
| `service` hardcoded to the literal `"backend"` | `src/features/health/controllers/health.controller.ts:12` |
| `Content-Type: application/json` (default Nest behavior for returned objects) | asserted in `test/integration/health.integration.spec.ts:73-81` |
| `HealthModule` registers `HealthController`; no providers, no imports | `src/features/health/health.module.ts:4-7` |
| `HealthModule` wired into `AppModule` | `src/app.module.ts:9` |
| Barrel exports `HealthModule` only | `src/features/health/index.ts:1` |
| Unit test (pure controller invocation, no Nest `TestingModule`) | `src/features/health/controllers/health.controller.spec.ts` |
| Integration test (`supertest` against running stack) | `test/integration/health.integration.spec.ts` |

### Consumers

| Consumer | File · lines | Notes |
|---|---|---|
| Kubernetes liveness probe | `projects/application/backend/chart/templates/deployment.yaml:34-39` | `httpGet` path from `values.yaml` `healthCheck.path` (`/health`), `service.port`. `initialDelaySeconds: 30`, `periodSeconds: 10`. |
| Kubernetes readiness probe | `projects/application/backend/chart/templates/deployment.yaml:40-45` | Same path/port. `initialDelaySeconds: 5`, `periodSeconds: 5`. |
| Helm probe path value | `projects/application/backend/chart/values.yaml:28` | `healthCheck.path` — must match the route above. |
| Local smoke check | `projects/application/backend/Taskfile.yml:45` | `curl -f http://localhost:${BACKEND_PORT}/health`. |
