# Health — Spec

## Purpose

A lightweight, unauthenticated liveness/readiness endpoint for the backend. Serves Kubernetes `livenessProbe` / `readinessProbe` (`projects/application/backend/chart/templates/deployment.yaml:34-45`), local `curl` health checks (`projects/application/backend/Taskfile.yml:45`), and any external monitoring that needs to confirm the Nest process is up and serving HTTP.

## Behavior

- Exposes a single route `GET /health` on the backend's main HTTP listener (`app/src/features/health/controllers/health.controller.ts:5-8`).
- Bypasses the global `KeycloakJwtGuard` via `@Public()` applied at the class level (`health.controller.ts:1-5`), so no cookie or `Authorization` header is required (guard opt-out behavior: `app/src/features/keycloak-auth/guards/keycloak-jwt.guard.ts` + `@Public()` metadata key `"isPublic"`).
- Always responds synchronously with HTTP `200` and a JSON body `{ status: "ok", timestamp, service: "backend" }` — there is no failure branch (`health.controller.ts:7-14`).
- `timestamp` is generated per-request via `new Date().toISOString()` (`health.controller.ts:11`), yielding ISO 8601 / RFC 3339 format (e.g. `2026-04-20T12:34:56.789Z`).
- `service` is the hardcoded literal string `"backend"` (`health.controller.ts:12`).
- Response `Content-Type` is `application/json` (default Nest behavior for returned objects; asserted in `app/test/integration/health.integration.spec.ts:73-81`).
- The check does NOT probe any dependency — no DB query, no Keycloak ping. It only confirms the Node/Nest process is accepting and handling HTTP. A dependency outage will not cause `/health` to fail.

## Components / Endpoints / Services

| Part | File | Notes |
|------|------|-------|
| `HealthModule` | `app/src/features/health/health.module.ts:4-7` | Registers `HealthController`; no providers, no imports. Wired into `AppModule` at `app/src/app.module.ts:9`. |
| `HealthController` | `app/src/features/health/controllers/health.controller.ts:4-15` | `@Public() @Controller("health")` with a single `@Get() check()` method. |
| Barrel | `app/src/features/health/index.ts:1` | Exports `HealthModule` only. |
| Unit test | `app/src/features/health/controllers/health.controller.spec.ts` | Pure controller invocation, no Nest `TestingModule`. |
| Integration test | `app/test/integration/health.integration.spec.ts` | `supertest` against running stack. |

## Consumers

| Consumer | Path | Notes |
|----------|------|-------|
| K8s liveness probe | `chart/templates/deployment.yaml:34-39` | `httpGet` path from `values.yaml` `healthCheck.path` (`/health`), `service.port`. `initialDelaySeconds: 30`, `periodSeconds: 10`. |
| K8s readiness probe | `chart/templates/deployment.yaml:40-45` | Same path/port; `initialDelaySeconds: 5`, `periodSeconds: 5`. |
| Local smoke check | `projects/application/backend/Taskfile.yml:45` | `curl -f http://localhost:${BACKEND_PORT}/health`. |

## Acceptance Criteria

- [ ] `GET /health` returns HTTP `200` with no credentials supplied.
- [ ] Response body is a JSON object with exactly the keys `status`, `timestamp`, `service`.
- [ ] `status` equals the literal string `"ok"`.
- [ ] `service` equals the literal string `"backend"`.
- [ ] `timestamp` is a valid ISO 8601 string (parseable by `new Date()` into a valid date).
- [ ] `timestamp` reflects the time of the current request (monotonically non-decreasing across sequential calls).
- [ ] Response `Content-Type` header matches `application/json`.
- [ ] Endpoint works without `access_token` cookie or `Authorization` header (confirms `@Public()` opt-out is effective).
- [ ] Endpoint path `/health` matches the Helm chart probe path in `chart/values.yaml:28` — any rename must change both.
