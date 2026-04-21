# Testing Tools — Flows

All flows start from `/smoke-tests`. The parent route's `authGuard` (`src/app/app.routes.ts:17`) has already ensured the user is authenticated; if not, they were redirected to `/login` before reaching this page.

## Flow 1: Initial Load

1. User (authenticated) navigates to `/smoke-tests` (default route — `app.routes.ts:19`).
2. `SmokeTestsPage` is lazy-loaded (`loadComponent` at `app.routes.ts:22-24`).
3. Page renders `<h1>Smoke Tests</h1>` and a CSS grid containing `<app-backend-health-check />` and `<app-typeorm-database-client />` (`pages/smoke-tests.page.ts:10-16`).
4. Each check component constructs with `loading = signal(false)` and `result = signal(null)` (`backend-health-check.component.ts:46-47`, `typeorm-database-client.component.ts:50-51`).
5. Both cards render with title + empty `mat-card-content` (no spinner, no result) + a `Check` button. **No HTTP requests are issued on mount.**

## Flow 2: Run Backend Health Check (Happy Path)

1. User clicks the `Check` button inside the "Backend Health" card.
2. `BackendHealthCheckComponent.check()` runs: `loading.set(true)` (`backend-health-check.component.ts:49-50`).
3. Template re-renders: `Check` button is disabled; a 24px `mat-spinner` replaces the (previous or empty) result.
4. `TestingToolsApiService.checkBackendHealth()` records `start = Date.now()` (`services/testing-tools.api.ts:15`), then calls `http.get<{ status: string }>(`${backendUrl}/health`, { withCredentials: true })` (`services/testing-tools.api.ts:17`).
5. `authInterceptor` adds `withCredentials: true` (redundantly) and `activityInterceptor` resets the inactivity timer (app-wide).
6. Backend responds 200. The service emits one `HealthCheckResult`: `{ status: 'ok', service: 'backend', responseTime: Date.now() - start }` then completes (`services/testing-tools.api.ts:19-26`).
7. Component callback: `result.set(res); loading.set(false)` (`backend-health-check.component.ts:51-54`).
8. Template shows `check_circle` (colored `--app-success`), the text "Healthy", and `{responseTime}ms` in `--app-text-secondary`. `Check` button is re-enabled.

## Flow 3: Backend Health Check — Error

1-5. Same as Flow 2.
6. HTTP call fails (network error, 4xx, 5xx). Angular `HttpClient` emits an `HttpErrorResponse`.
7. Service's `error` branch emits `{ status: 'error', service: 'backend', responseTime: Date.now() - start, error: err.message }` then completes (`services/testing-tools.api.ts:27-35`). The outer `Observable` never errors — it always `next()`s a result.
8. Component callback: `result.set(res); loading.set(false)` (same path as happy case, since the service swallows the error).
9. Template shows `error` icon in `--app-error` and the raw `err.message` text; the optional response-time span still renders if `responseTime` was captured. `Check` button is re-enabled for retry.

Note: A 401 on `/health` would first be caught by `authInterceptor`, which attempts `POST /auth/refresh` and retries once before propagating. Only a second 401 (or any non-auth error) reaches this error branch.

## Flow 4: Run Database Check (Happy Path, With Tables)

1. User clicks `Check` inside "Database Connection".
2. `TypeormDatabaseClientComponent.check()` sets `loading.set(true)` (`typeorm-database-client.component.ts:53-54`).
3. Card renders a 24px spinner; button is disabled.
4. `TestingToolsApiService.checkDatabase()` calls `http.get<DatabaseCheckResult>(`${backendUrl}/health/database`, { withCredentials: true })` (`services/testing-tools.api.ts:41-44`).
5. Backend responds 200 with `{ connected: true, tables: ['users','sessions', ...] }`.
6. Component `next` handler: `result.set(res); loading.set(false)` (`typeorm-database-client.component.ts:55-57`).
7. Template shows `storage` icon in `--app-success` + "Connected", then a `mat-list dense` below with one `mat-list-item` per table name (tracked by the table string — `typeorm-database-client.component.ts:29-31`).

## Flow 5: Database Check — Server-Reported Failure

1-4. Same as Flow 4.
5. Backend responds 200 with `{ connected: false, error: 'ECONNREFUSED ...' }` (or similar).
6. Component `next` handler stores the result (error path inside the component is not triggered — it was a 200 with `connected: false`).
7. Template shows `error` icon in `--app-error` + the `error` string. No table list is rendered (falsy `result()?.tables?.length`).

## Flow 6: Database Check — HTTP Error

1-4. Same as Flow 4.
5. HTTP call errors (network, 4xx, 5xx). Unlike the backend-health service, this service does NOT wrap the call; the error propagates to the component.
6. Component `error` callback: `result.set({ connected: false, error: err.message }); loading.set(false)` (`typeorm-database-client.component.ts:56-58`).
7. Template renders the same error UI as Flow 5.

## Flow 7: Re-Running a Check

1. User clicks `Check` again on either card after a previous result is displayed.
2. Component sets `loading.set(true)` (but does NOT clear `result()`). Because the template guards on `@if (loading())` first, the previous result is hidden and the spinner shown instead (`backend-health-check.component.ts:19-29`).
3. On response, the new result replaces the old one. Each click issues exactly one HTTP request.
