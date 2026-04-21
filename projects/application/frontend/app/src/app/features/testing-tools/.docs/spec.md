# Testing Tools — Spec

## What it is

The `/smoke-tests` page is a diagnostic screen where a signed-in user can manually verify two backend dependencies: the HTTP health endpoint and the database connection. It is the default landing page after login and is used as a post-deploy smoke test for sandboxes. The page shows an "Smoke Tests" heading above two independent check cards — Backend Health and Database Connection — arranged side by side in a responsive grid that wraps to a single column on narrow screens.

## How it behaves

### Opening the page

When the user navigates to `/smoke-tests`, the page renders the heading and both cards empty — no spinner, no result, no network activity. Nothing runs automatically; there is no polling and no on-mount fetch. The left-nav lists this page as "Smoke Tests".

Reaching the page requires an authenticated session: access is gated by the auth guard inherited from the parent layout route.

### Clicking Check on the Backend Health card

Clicking Check on the Backend Health card disables the button, replaces the card body with a spinner, and issues a single authenticated `GET /health` request to the backend. When the response comes back, the card shows a green check-circle icon, the word "Healthy", and the round-trip time in milliseconds measured on the client. The button is re-enabled. Clicking Check again replaces the previous result rather than appending.

### Clicking Check on the Database Connection card

Clicking Check on the Database Connection card disables the button, replaces the card body with a spinner, and issues a single authenticated `GET /health/database` request. On success, the card shows a green storage icon and the word "Connected"; if the response includes a non-empty list of table names, those names render as a dense list beneath the status line. An empty or missing list renders only the status line. Clicking Check again replaces the previous result.

### Error paths

If the backend health request fails, the Backend Health card shows a red error icon and the HTTP error message, and the button is re-enabled.

If the database request fails — either because the server reports `connected: false` or because the HTTP call itself errors — the Database Connection card shows a red error icon and the error string, and the button is re-enabled.

### Independence of the two cards

The two cards operate independently. Either can be clicked at any time; running one does not affect the loading state or the displayed result of the other.

## Acceptance criteria

- [ ] Navigating to `/smoke-tests` renders the "Smoke Tests" heading and two cards titled "Backend Health" and "Database Connection".
- [ ] Neither card fires a request on mount — cards are empty until Check is clicked.
- [ ] Clicking Check on the Backend Health card issues exactly one `GET /health` with credentials and disables the button until the response returns.
- [ ] A successful backend health response renders a green check-circle, the word "Healthy", and an `{n}ms` response time measured on the client.
- [ ] A failed backend health request renders a red error icon and the HTTP error message; the Check button is re-enabled.
- [ ] Clicking Check on the Database Connection card issues exactly one `GET /health/database` with credentials.
- [ ] A database success with a non-empty `tables` list renders one list item per table name below the status line.
- [ ] A database success with an empty or missing `tables` list renders only the status line.
- [ ] A database failure (server reports `connected: false`, or the HTTP call errors) renders a red error icon and the error string.
- [ ] The two cards operate independently; running one does not affect the state or loading indicator of the other.
- [ ] The grid wraps to a single column below roughly 300px card width and stays usable on mobile.

## Known gaps

- The feature directory is named `testing-tools/` but the route it serves is `/smoke-tests`, so the URL and the folder don't match.
- The backend health result's `service` field is hardcoded to the literal string `'backend'` rather than being derived, so the field carries no real information.
- The two checks handle HTTP errors asymmetrically: the backend health service swallows errors internally and returns a normal result object with an error status, while the database service lets errors propagate and relies on the component to catch them. The user-visible behavior is similar, but the code paths differ.
- There are no unit tests colocated with this feature.

## Code map

Paths are relative to `projects/application/frontend/app/`.

| Concern | File · lines |
|---|---|
| Route registration (`/smoke-tests` as default authenticated route) | `src/app/app.routes.ts:19-24` |
| Auth guard inherited from parent layout route | `src/app/app.routes.ts:17` |
| Page: heading + responsive grid of check cards | `src/app/features/testing-tools/pages/smoke-tests.page.ts:10-16,20-24,28` |
| Backend Health card: click handler, loading state, spinner/result rendering | `src/app/features/testing-tools/components/backend-health-check/backend-health-check.component.ts:18-30,44` |
| Backend Health service call (`GET /health`, credentials, client-side timing) | `src/app/features/testing-tools/services/testing-tools.api.ts:15,17,22,27-35,31` |
| Database card: click handler, loading state, result + table list rendering | `src/app/features/testing-tools/components/typeorm-database-client/typeorm-database-client.component.ts:19-34,27-33,48` |
| Database card: HTTP error caught and mapped to `{ connected: false, error }` | `src/app/features/testing-tools/components/typeorm-database-client/typeorm-database-client.component.ts:56-58` |
| Database service call (`GET /health/database`, credentials) | `src/app/features/testing-tools/services/testing-tools.api.ts:41-44` |
| API service class (HTTP client for both checks) | `src/app/features/testing-tools/services/testing-tools.api.ts:10` |
| Result types: `HealthCheckResult`, `DatabaseCheckResult` | `src/app/features/testing-tools/types.ts:1-6,8-12` |
| Compatibility NgModule wrapping the three standalone components | `src/app/features/testing-tools/testing-tools.module.ts:6-10` |
