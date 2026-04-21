# API Client — Test Plan

Each item maps to an acceptance criterion in `spec.md` and/or a flow in `flows.md`. File/line citations point at the behavior under test.

## AppConfigService

- [ ] `provideAppInitializer` blocks bootstrap until `load()` resolves (`app.config.ts:17-20`).
- [ ] `load()` issues `fetch('/config.json', { cache: 'no-store' })` — verify cache option, not `HttpClient` (`app-config.service.ts:25`).
- [ ] Non-2xx `/config.json` response throws `Failed to load /config.json (<status>). ...` (`app-config.service.ts:26-31`).
- [ ] Missing `backendUrl` in JSON throws `Missing required config keys in /config.json: backendUrl. ...` (`app-config.service.ts:35-41`).
- [ ] Empty string `backendUrl` is treated as missing (`app-config.service.ts:35` — falsy filter).
- [ ] `backendUrl` getter throws `App config not loaded. ...` before `load()` resolves (`app-config.service.ts:16-22`).
- [ ] After a successful `load()`, `backendUrl` returns the exact string from the JSON and `config()` signal is populated (`app-config.service.ts:43`).

## Auth Interceptor

- [ ] Every outbound request has `withCredentials: true` after cloning (`auth.interceptor.ts:15`).
- [ ] A 2xx response passes through unmodified.
- [ ] A 401 on a non-`/auth/` URL triggers exactly one `POST {backendUrl}/auth/refresh` (`auth.interceptor.ts:19,36`).
- [ ] A 401 on a URL containing `/auth/` (e.g. `/auth/check`, `/auth/login`) is re-thrown without a refresh attempt (`auth.interceptor.ts:19,22`).
- [ ] After a successful refresh, the original 401 request is retried and its response is delivered to the caller (`auth.interceptor.ts:37-41`).
- [ ] With N concurrent 401s, only one `POST /auth/refresh` is sent; the other N-1 requests wait on `refreshSubject` and retry after it emits `true` (`auth.interceptor.ts:32-54`).
- [ ] A failed refresh calls `SessionManagementService.logout()` and re-throws the refresh error (`auth.interceptor.ts:42-46`).
- [ ] After a failed refresh, `isRefreshing` is reset to `false` so a later 401 can trigger another refresh attempt (`auth.interceptor.ts:43`).

## Activity Interceptor

- [ ] `recordActivity()` is called on every request (success and error) (`activity.interceptor.ts:8-10`).
- [ ] Running the interceptor updates `SessionManagementService.lastActivity` to the current `Date.now()` (`session-management.service.ts:45-47`).

## SessionManagementService

- [ ] `startTimers()` clears any previous subscriptions before creating new ones (`session-management.service.ts:22-23`).
- [ ] Proactive refresh fires every 4 minutes (`REFRESH_INTERVAL_MS`) and issues `POST {backendUrl}/auth/refresh` with `withCredentials: true` (`session-management.service.ts:8,26-28,49-55`).
- [ ] Inactivity check fires every 60 s; when `Date.now() - lastActivity > 30 min`, `logout()` is called (`session-management.service.ts:9,31-35`).
- [ ] `recordActivity()` sets `lastActivity = Date.now()` (`session-management.service.ts:45-47`).
- [ ] `logout()` stops timers, issues `POST {backendUrl}/auth/logout` with `withCredentials: true`, and navigates to `/login` on both complete and error (`session-management.service.ts:57-65`).
- [ ] `stopTimers()` unsubscribes and nulls both `refreshSub` and `inactivitySub` (`session-management.service.ts:38-43`).
- [ ] `ngOnDestroy()` calls `stopTimers()` (`session-management.service.ts:67-69`).

## WebSocketClientService

- [ ] `connect(namespace)` opens `io(\`${backendUrl}/${namespace}\`, { transports: ['websocket','polling'], withCredentials: true })` (`websocket-client.service.ts:18-22`).
- [ ] Calling `connect` twice disconnects the previous socket before creating a new one (`websocket-client.service.ts:14-16`).
- [ ] `on<T>(event)` returns an Observable that registers `socket.on(event, ...)` on subscribe and `socket.off(event, ...)` on teardown (`websocket-client.service.ts:24-38`).
- [ ] `on` emits a `"WebSocket not connected"` error when subscribed before `connect()` (`websocket-client.service.ts:26-29`).
- [ ] `emit` throws `"WebSocket not connected"` when called before `connect()` (`websocket-client.service.ts:40-45`).
- [ ] `disconnect()` calls `socket.disconnect()` and nulls the reference (`websocket-client.service.ts:47-50`).
- [ ] `ngOnDestroy` calls `disconnect()` (`websocket-client.service.ts:52-54`).

## Integration

- [ ] End-to-end: with a valid session cookie, a feature HTTP call arrives at the backend with the cookie attached and CORS succeeds.
- [ ] End-to-end: simulating a server-side cookie expiry on a `/users` request produces exactly one `/auth/refresh` and one retried `/users` request from the browser.
- [ ] End-to-end: `/auth/check` returning 401 during `authGuard` redirects the user to `/login` without attempting a refresh.
