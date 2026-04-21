# Health — Contracts

## Endpoints

### `GET /health`

**Source:** `app/src/features/health/controllers/health.controller.ts:5-14`
**Auth:** Public — class-level `@Public()` bypasses the global `KeycloakJwtGuard` (`health.controller.ts:4`).
**Request:** No body, no query params, no required headers.
**Status codes:**

| Code | When |
|------|------|
| `200 OK` | Always — the handler has no error branches (`health.controller.ts:7-14`). |

**Response body:**

```typescript
{
  status: "ok";      // literal string, always "ok"
  timestamp: string; // ISO 8601, e.g. "2026-04-20T12:34:56.789Z" (new Date().toISOString())
  service: "backend"; // literal string, always "backend"
}
```

**Response headers:**
- `Content-Type: application/json; charset=utf-8` (Nest default for JSON-serializable returns; verified in `app/test/integration/health.integration.spec.ts:73-81`).

**Example response:**

```json
{
  "status": "ok",
  "timestamp": "2026-04-20T12:34:56.789Z",
  "service": "backend"
}
```

## Shared Types

No exported types. The response shape is inline in the controller (`health.controller.ts:9-13`) and duplicated in test assertions (`health.controller.spec.ts:22-24`, `health.integration.spec.ts:28-31`). If a consumer needs a typed shape, define it locally from the schema above.

## External Contracts

The endpoint path is also a contract with the Helm chart:

| Contract | Source | Value |
|----------|--------|-------|
| Liveness probe path | `projects/application/backend/chart/values.yaml:28` | `/health` |
| Readiness probe path | same | `/health` (shared key) |
| Probe port | `chart/templates/deployment.yaml:37,43` | `{{ .Values.service.port }}` |

Renaming or relocating this endpoint requires updating `chart/values.yaml` `healthCheck.path` in lockstep.
