# Testing Tools — Spec

**Feature directory:** `src/app/features/testing-tools/`
**Route:** `/smoke-tests` — the default authenticated route (`src/app/app.routes.ts:19-24`)
**Auth:** Inherited `authGuard` on the parent layout route (`src/app/app.routes.ts:17`)

## Purpose

Diagnostic page that lets an authenticated user manually verify two backend dependencies: the HTTP `/health` endpoint and the TypeORM database connection. It is the default landing page after login and is used as a post-deploy smoke test for sandboxes.

## Behavior

- Page renders an `<h1>Smoke Tests</h1>` heading plus a CSS-grid of check cards (`pages/smoke-tests.page.ts:10-16`, `auto-fit, minmax(300px, 1fr)`, 24px gap at `pages/smoke-tests.page.ts:20-24`).
- Two independent checks are shown side-by-side: Backend Health and Database Connection. Each lives in its own `mat-card` and is triggered independently.
- **No auto-refresh, no polling, no on-mount fetch.** Cards render empty (no spinner, no result) until the user clicks the card's `Check` button (`backend-health-check.component.ts:18-30`, `typeorm-database-client.component.ts:19-34`).
- **Backend Health** (`components/backend-health-check/backend-health-check.component.ts`):
  - Click `Check` -> `loading` signal goes true, spinner (24px diameter) replaces card content.
  - Calls `TestingToolsApiService.checkBackendHealth()` which issues `GET {backendUrl}/health` with `withCredentials: true` (`services/testing-tools.api.ts:17`).
  - On success: displays `check_circle` icon in `--app-success` color + text "Healthy" + response-time in ms (`{n}ms` in `--app-text-secondary`, `0.875rem`).
  - On HTTP error: displays `error` icon in `--app-error` color + the raw `err.message` string. The service swallows the error and emits a result with `status: 'error'` (`services/testing-tools.api.ts:27-35`).
  - Response-time is measured client-side as `Date.now() - start` around the HTTP call (`services/testing-tools.api.ts:15,22,31`); server timestamps are not used.
- **Database Connection** (`components/typeorm-database-client/typeorm-database-client.component.ts`):
  - Click `Check` -> spinner (24px) while in flight.
  - Calls `TestingToolsApiService.checkDatabase()` -> `GET {backendUrl}/health/database` with `withCredentials: true` (`services/testing-tools.api.ts:41-44`).
  - On success (`connected: true`): `storage` icon in `--app-success` + text "Connected". If `tables` array is non-empty, they render below as a `mat-list dense` with one `mat-list-item` per table name (`typeorm-database-client.component.ts:27-33`).
  - On failure (`connected: false` from server, or HTTP error): `error` icon in `--app-error` + the `error` message. HTTP errors are caught in the component and converted to `{ connected: false, error: err.message }` (`typeorm-database-client.component.ts:56-58`).
- Both `Check` buttons are disabled while their own request is in flight (`[disabled]="loading()"`). The two checks do not coordinate — either can run independently and results persist across subsequent clicks (replaced, not appended).
- Nav registration: the left-nav lists this page as "Smoke Tests" under `navigationConfig` (not in this feature).

## Components / Services

| Symbol | Kind | File | Role |
|---|---|---|---|
| `SmokeTestsPage` | Page (standalone) | `pages/smoke-tests.page.ts:28` | Hosts the two check components in a responsive grid |
| `BackendHealthCheckComponent` | Component (standalone) | `components/backend-health-check/backend-health-check.component.ts:44` | UI + logic for `/health` check |
| `TypeormDatabaseClientComponent` | Component (standalone) | `components/typeorm-database-client/typeorm-database-client.component.ts:48` | UI + logic for `/health/database` check |
| `TestingToolsApiService` | Service (`providedIn: 'root'`) | `services/testing-tools.api.ts:10` | HTTP client for both checks |
| `HealthCheckResult` | Type | `types.ts:1-6` | `{ status: 'ok' \| 'error'; service: string; responseTime?: number; error?: string }` |
| `DatabaseCheckResult` | Type | `types.ts:8-12` | `{ connected: boolean; tables?: string[]; error?: string }` |
| `TestingToolsModule` | NgModule (compatibility) | `testing-tools.module.ts:6-10` | Empty wrapper re-exporting the three standalone components |

All components use `ChangeDetectionStrategy.OnPush` and local `signal()` state.

## Acceptance Criteria

- [ ] Navigating to `/smoke-tests` renders the `Smoke Tests` heading and two cards titled "Backend Health" and "Database Connection".
- [ ] Neither card fires a request on mount — cards are empty until `Check` is clicked.
- [ ] Clicking "Backend Health" -> `Check` issues exactly one `GET /health` with credentials and disables the button until the response returns.
- [ ] Successful backend health response renders `check_circle` (success color), the word "Healthy", and an `{n}ms` response time.
- [ ] Backend health HTTP error renders `error` (error color) and the HTTP error message; the `Check` button is re-enabled.
- [ ] Clicking "Database Connection" -> `Check` issues exactly one `GET /health/database` with credentials.
- [ ] Database success with `tables: string[]` renders one `mat-list-item` per table name below the status line.
- [ ] Database success with empty/missing `tables` renders only the status line.
- [ ] Database failure (`connected: false` or HTTP error) renders `error` icon and the error string.
- [ ] The two cards operate independently; running one does not affect the state or loading indicator of the other.
- [ ] Grid wraps to a single column below ~300px card width (auto-fit grid) and stays usable on mobile.
