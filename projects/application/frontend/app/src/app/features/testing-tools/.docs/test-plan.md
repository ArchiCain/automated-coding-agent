# Testing Tools — Test Plan

Tests cover the smoke-tests page itself. Cross-reference with `spec.md` acceptance criteria and `flows.md`.

## Render / Layout

- [ ] Navigating to `/smoke-tests` renders an `<h1>` with text "Smoke Tests" (`pages/smoke-tests.page.ts:11`).
- [ ] Both `<app-backend-health-check>` and `<app-typeorm-database-client>` are present in the grid (`pages/smoke-tests.page.ts:13-14`).
- [ ] Grid uses `grid-template-columns: repeat(auto-fit, minmax(300px, 1fr))` with 24px gap (`pages/smoke-tests.page.ts:20-24`).
- [ ] Neither card fires any HTTP request on mount (assert via spy/mock on `HttpClient` or `TestingToolsApiService`).
- [ ] Each card renders its title text ("Backend Health", "Database Connection") and an enabled `Check` button.

## Backend Health — Behavior

- [ ] Clicking `Check` calls `TestingToolsApiService.checkBackendHealth()` exactly once per click.
- [ ] While loading: spinner is visible, `Check` button has `disabled` attribute true, `result` area is hidden.
- [ ] On `{status: 'ok'}` 200: renders `check_circle` icon, text "Healthy", and a `{n}ms` span containing the measured response time.
- [ ] Icon color comes from `--app-success` on success (`.result.ok mat-icon` rule, `backend-health-check.component.ts:38`).
- [ ] Response-time span only renders when `responseTime` is truthy (`backend-health-check.component.ts:25-27`).
- [ ] On HTTP error: renders `error` icon (color `--app-error`) and the `err.message` text.
- [ ] After either outcome, `Check` button returns to enabled and a second click fires another request.

## Database — Behavior

- [ ] Clicking `Check` calls `TestingToolsApiService.checkDatabase()` exactly once per click.
- [ ] Loading: spinner visible, button disabled.
- [ ] Success with `connected: true, tables: ['a','b']`: renders `storage` icon, text "Connected", and a `mat-list` with items "a" and "b" in order.
- [ ] Success with `connected: true, tables: []`: renders only the status line — no `mat-list`.
- [ ] Success with `connected: true` and no `tables` field: renders only the status line.
- [ ] Success with `connected: false, error: 'X'`: renders `error` icon and text "X".
- [ ] HTTP error: component substitutes `{ connected: false, error: err.message }` — same error UI as server-reported failure.

## Contract Tests (against service, not backend)

- [ ] `checkBackendHealth()` requests `GET {backendUrl}/health` with `withCredentials: true` (`services/testing-tools.api.ts:17`).
- [ ] `checkBackendHealth()` always `next()`s a `HealthCheckResult` and completes; it never errors (swallow-and-emit — `services/testing-tools.api.ts:27-35`).
- [ ] `responseTime` is non-negative and reflects wall-clock elapsed ms around the HTTP call.
- [ ] `checkDatabase()` requests `GET {backendUrl}/health/database` with `withCredentials: true` and surfaces errors via the Observable's error channel (`services/testing-tools.api.ts:41-44`).
- [ ] `backendUrl` is read from `AppConfigService` at call time — the service must be constructible only after `provideAppInitializer` has loaded `/config.json`.

## Independence

- [ ] Clicking `Check` on one card does not trigger an HTTP call for the other.
- [ ] Loading state of one card does not disable the other card's button.
- [ ] Previous successful result on one card remains visible while the other card is loading.

## E2E (sandbox, logged in)

- [ ] Auth'd user landing on `/` is redirected to `/smoke-tests` (`app.routes.ts:19`).
- [ ] Running Backend Health against a live sandbox returns "Healthy" with a visible ms value.
- [ ] Running Database against a live sandbox returns "Connected" and renders at least the `users` table in the list.
- [ ] Simulating backend-down (e.g. scaling backend to 0 or blocking the URL) surfaces the error branch UI on both cards without crashing the page.
