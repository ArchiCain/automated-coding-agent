# API Client — Spec

## What it is

The frontend's shared plumbing for talking to the backend. It loads a small runtime configuration file at startup so the rest of the app knows where the backend lives, attaches the session cookie to every outgoing request, quietly refreshes that session when the server says it has expired, keeps track of how long the user has been idle, and provides a single way to open a real-time connection to the backend. Every other feature in the frontend depends on this one for backend I/O.

## How it behaves

### Loading runtime configuration

Before the app renders anything, it fetches `/config.json` from the same origin that served the page, bypassing the browser cache. The file must return successfully and must contain a non-empty `backendUrl`; if either check fails, startup aborts with a descriptive error that names the missing key or the HTTP status. The fetch is done without the normal HTTP stack so that the request and response do not pass through the auth plumbing that depends on this config being loaded. The shipped default is `{ "backendUrl": "/api" }`, which the deployed container image rewrites at launch. Any feature that asks for the backend URL before the config has finished loading gets an error pointing at the startup step.

### Making a request

Every HTTP request the app sends is adjusted so the browser attaches the session cookie, which is what the backend uses to identify the user. Each request also resets an internal "last activity" timestamp.

### Reacting to a 401

When a response comes back as `401 Unauthorized`, the behavior depends on the URL:

- **Non-auth URLs** (anything whose path does not contain `/auth/`): the client sends a single refresh request to the backend to try to renew the session, then retries the original request. If several requests happen to fail with 401 at the same time, only one refresh goes out — the rest wait for it to finish and then retry in order. If the refresh itself fails, the client logs the user out (ending the session on the server, stopping background timers, and navigating to `/login`) and re-raises the original error.
- **Auth URLs** (paths containing `/auth/`, such as `/auth/login` or `/auth/check`): the 401 passes straight through to the caller with no refresh attempt.

### Proactive refresh and inactivity logout

A session-management helper can run two background timers: one that refreshes the session every four minutes so it never expires mid-use, and one that checks every minute whether the user has been idle for more than thirty minutes and logs them out if so. Logging out calls the backend's logout endpoint, stops the timers, and navigates to `/login` — both on success and on error.

### Opening a real-time connection

Features that need live updates ask the API client to open a named channel (a WebSocket connection to `${backendUrl}/${namespace}`). The connection prefers WebSocket transport but falls back to polling, and always carries the session cookie. Opening a channel while one is already open closes the old one first. Subscribing to an event on the channel returns a stream that cleanly detaches its listener when the subscriber goes away. Subscribing or sending on a channel that is not currently open raises an error rather than silently doing nothing. Closing the channel tears down the connection and forgets it.

## Acceptance criteria

- [ ] `/config.json` is fetched with caching disabled and finishes before the root component renders.
- [ ] Asking for the backend URL before the config has loaded throws an error.
- [ ] A non-2xx response or a missing/empty `backendUrl` aborts startup with a descriptive error that names the status or the missing key.
- [ ] The config fetch does not go through the app's own HTTP stack (so it can't trigger the auth plumbing).
- [ ] Every HTTP request the app sends includes the session cookie.
- [ ] A 401 on a non-auth URL triggers exactly one refresh, even when multiple requests fail at the same time.
- [ ] After a successful refresh, the original failing request is retried and any requests queued behind it are released and retried.
- [ ] A failed refresh logs the user out (backend logout call, timers stopped, navigate to `/login`) and the original error is re-raised.
- [ ] A 401 on an auth URL propagates to the caller unchanged.
- [ ] Every outgoing request resets the "last activity" timestamp.
- [ ] When the background timers are running, the session refreshes every four minutes and the user is logged out after thirty minutes of inactivity.
- [ ] Opening a real-time channel produces a single connection at `${backendUrl}/${namespace}` with WebSocket-preferred transport and the session cookie attached.
- [ ] Unsubscribing from a channel event detaches the underlying listener.
- [ ] Sending or subscribing on a channel that is not open raises an error instead of silently no-oping.
- [ ] Opening a channel while one is already open closes the old one first.

## Known gaps

- The proactive refresh and inactivity logout timers are dormant — nothing in the app calls `startTimers()`, so the four-minute refresh and thirty-minute idle logout never actually run. See `services/session-management.service.ts:22`.
- When concurrent 401s are queued behind a refresh and the refresh then fails, the waiting subscribers are not released or cleaned up, so they leak. See `interceptors/auth.interceptor.ts:32-54`.
- `api-client.module.ts` is an empty `@NgModule` placeholder with no declarations; it exists only as a barrel and could be deleted. See `api-client.module.ts:4`.

## Code map

Precise pointers for an agent or a reader who needs the ground truth. Paths are relative to `projects/application/frontend/app/`.

| Concern | File · lines |
|---|---|
| Startup step that awaits config load | `src/app/app.config.ts:17-20` |
| HTTP interceptor registration order | `src/app/app.config.ts:15` |
| Config fetch (bypass cache, no HTTP stack) | `src/app/features/api-client/services/app-config.service.ts:25` |
| Non-2xx response error message | `services/app-config.service.ts:26-31` |
| Missing/empty `backendUrl` error message | `services/app-config.service.ts:35-41` |
| `backendUrl` getter guard | `services/app-config.service.ts:16-22` |
| Shipped default config | `public/config.json` |
| Attach session cookie to every request | `src/app/features/api-client/interceptors/auth.interceptor.ts:15` |
| Skip refresh on `/auth/*` URLs | `interceptors/auth.interceptor.ts:19` |
| Single-flight refresh gate for concurrent 401s | `interceptors/auth.interceptor.ts:9,32-54` |
| Failed refresh triggers logout and re-raises | `interceptors/auth.interceptor.ts:42-46` |
| Reset last-activity timestamp per request | `src/app/features/api-client/interceptors/activity.interceptor.ts:7-11` |
| Four-minute refresh + one-minute idle check (30-min threshold) | `src/app/features/api-client/services/session-management.service.ts:22-36` |
| Record activity | `services/session-management.service.ts:45-47` |
| Idle-tick logout trigger | `services/session-management.service.ts:31-35` |
| Refresh call with cookies | `services/session-management.service.ts:49-55` |
| Logout: stop timers, call backend, navigate to `/login` | `services/session-management.service.ts:57-65` |
| Timer teardown on destroy | `services/session-management.service.ts:67-69` |
| Open real-time channel (prefer WS, fall back to polling, with cookies) | `src/app/features/api-client/services/websocket-client.service.ts:13-22` |
| Event stream with clean listener teardown | `services/websocket-client.service.ts:24-38` |
| Send raises when channel not open | `services/websocket-client.service.ts:40-45` |
| Close channel and forget it | `services/websocket-client.service.ts:47-54` |
| Empty NgModule placeholder | `src/app/features/api-client/api-client.module.ts:4` |
| Types: `AppConfig` | `services/app-config.service.ts:4-6` |
| Types: `ApiError` | `src/app/features/api-client/types.ts:2-6` |

### Runtime configuration

| Key | Source | Default | Consumers |
|---|---|---|---|
| `backendUrl` | `public/config.json` — fetched at bootstrap | `/api` | All `*.api.ts` services, `ThemeService`, `ChatService`, `AppConfigService`, `SessionManagementService`, `WebSocketClientService` |
