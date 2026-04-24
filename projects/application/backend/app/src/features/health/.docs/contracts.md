# Health — Contracts

## Endpoints

### `GET /health`

**Source:** `app/src/features/health/controllers/health.controller.ts:12-20`
**Auth:** Public — method-level `@Public()` bypasses the global `KeycloakJwtGuard` for this handler only. Other handlers in the same controller (e.g. `GET /health/database`) require auth.
**Request:** No body, no query params, no required headers.
**Status codes:**

| Code | When |
|------|------|
| `200 OK` | Always — the handler has no error branches (`health.controller.ts:14-20`). |

**Response body:**

```typescript
{
  status: "ok";       // literal string, always "ok"
  timestamp: string;  // ISO 8601, e.g. "2026-04-20T12:34:56.789Z" (new Date().toISOString())
  service: "backend"; // literal string, always "backend"
}
```

**Response headers:**
- `Content-Type: application/json; charset=utf-8` (Nest default for JSON-serializable returns).

**Example response:**

```json
{
  "status": "ok",
  "timestamp": "2026-04-20T12:34:56.789Z",
  "service": "backend"
}
```

---

### `GET /health/database`

**Source:** `app/src/features/health/controllers/health.controller.ts:22-43`
**Auth:** Required. The global `KeycloakJwtGuard` rejects callers without a valid `access_token` cookie (returns `401` before the handler runs).
**Request:** No body, no query params. `Cookie: access_token=…` required.
**Status codes:**

| Code | When |
|------|------|
| `200 OK` | Always when authenticated — the handler catches its own errors and encodes them in the body. The one exception is `401`, which is returned by the guard (not the handler) when authentication fails. |
| `401 Unauthorized` | Missing or invalid `access_token` cookie. |

**Response body (authenticated, on success):**

```typescript
{
  connected: true;
  tables: string[];  // table names in the current schema, ordered ascending
}
```

**Response body (authenticated, on soft error):**

```typescript
{
  connected: false;
  error: string;  // Error.message from the underlying failure
}
```

The handler returns `connected: false` with an error in two cases:
- The TypeORM `DataSource` is not initialized → `error: "Data source not initialized"`.
- The `pg_tables` query throws (connection reset, auth error, permission denied) → `error: <Error.message>`.

**Response headers:**
- `Content-Type: application/json; charset=utf-8`.

**Example response (success):**

```json
{
  "connected": true,
  "tables": ["examples", "typeorm_migrations", "users"]
}
```

**Example response (soft error):**

```json
{
  "connected": false,
  "error": "connection timeout"
}
```

## Shared Types

The frontend models both endpoints in `projects/application/frontend/app/src/app/features/testing-tools/types.ts`:

```typescript
export interface HealthCheckResult {
  status: "ok" | "error";
  service: string;
  responseTime?: number;
  error?: string;
}

export interface DatabaseCheckResult {
  connected: boolean;
  tables?: string[];
  error?: string;
}
```

The backend returns a narrower shape for each (neither response includes `responseTime` — the frontend synthesizes that from the request latency). For typed consumers, the schemas above are authoritative.

## External Contracts

- **Frontend Testing Tools** calls `GET /health/database` with `withCredentials: true`. The endpoint path is hard-coded in `projects/application/frontend/app/src/app/features/testing-tools/services/testing-tools.api.ts:41-44` — renaming the backend route requires updating both sides in lockstep.
- **Local smoke task** `task backend:local:health` curls `/health`. The path is hard-coded in `projects/application/backend/Taskfile.yml`.
