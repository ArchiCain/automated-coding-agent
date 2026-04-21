# Health — Test Plan

Backed by:
- Unit: `app/src/features/health/controllers/health.controller.spec.ts`
- Integration: `app/test/integration/health.integration.spec.ts`

## Contract Tests (`GET /health`)

- [ ] Returns HTTP `200` (`health.integration.spec.ts:14-19`).
- [ ] Response `Content-Type` matches `application/json` (`health.integration.spec.ts:73-81`).
- [ ] Response body has the keys `status`, `timestamp`, `service` and nothing more surprising (`health.integration.spec.ts:21-32`).
- [ ] `status === "ok"` (`health.integration.spec.ts:29`, `health.controller.spec.ts:22`).
- [ ] `service === "backend"` (`health.integration.spec.ts:30`, `health.controller.spec.ts:23`).
- [ ] `timestamp` matches ISO 8601 pattern `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}` and parses to a valid `Date` (`health.integration.spec.ts:34-47`, `health.controller.spec.ts:27-36`).

## Behavior Tests

- [ ] No authentication required — request with no `access_token` cookie and no `Authorization` header still returns `200` (`health.integration.spec.ts:66-71`). This verifies `@Public()` opt-out on `HealthController`.
- [ ] `timestamp` reflects "now" — it falls between the timestamps captured immediately before and after the request (`health.integration.spec.ts:49-64`).
- [ ] Timestamp is regenerated per call — two sequential invocations yield `t2 >= t1` (`health.controller.spec.ts:38-47`).
- [ ] Endpoint is stable under repeated load — 5 sequential requests each return `200` with `status: "ok"` (`health.integration.spec.ts:83-97`).

## E2E / Smoke

- [ ] `curl -f http://localhost:${BACKEND_PORT}/health` exits `0` against a locally running stack (`projects/application/backend/Taskfile.yml:45`).
- [ ] In-cluster: pod becomes `Ready` only after `/health` returns `200`, confirming the readiness probe path (`chart/templates/deployment.yaml:40-45`) is correctly wired to this controller.

## Not In Scope

- No dependency health checks (DB, Keycloak) are tested — by design, this endpoint never consults them (`health.controller.ts:7-14`).
- No negative-path tests exist because the handler has no error branches.
