# API Client — Flows

## Flow 1: Application bootstrap — runtime config load

1. Browser requests `index.html`; `main.ts` calls `bootstrapApplication(App, appConfig)` (`src/main.ts`).
2. `appConfig.providers` wires `provideHttpClient(withInterceptors([authInterceptor, activityInterceptor]))` and `provideAppInitializer(() => inject(AppConfigService).load())` (`app.config.ts:11-22`).
3. Angular runs the initializer and blocks rendering on the returned promise (`app.config.ts:17-20`).
4. `AppConfigService.load()` does `fetch('/config.json', { cache: 'no-store' })` (`services/app-config.service.ts:25`). In deployed builds this file is rewritten by the nginx container at startup; in dev it is served from `public/config.json` (`{ "backendUrl": "/api" }`).
5. If the response is not OK, the promise rejects with `Failed to load /config.json (<status>). ...` and bootstrap aborts (`app-config.service.ts:26-31`).
6. The JSON is validated: if any key in `REQUIRED_KEYS = ['backendUrl']` is missing or falsy, the promise rejects with `Missing required config keys in /config.json: backendUrl. ...` (`app-config.service.ts:35-41`).
7. On success, the `_config` signal is populated (`app-config.service.ts:43`). The `backendUrl` getter is now safe to read for the remainder of the session.
8. Angular resolves the initializer, instantiates `App`, and `<router-outlet>` renders. `authGuard` on `''` drives to `/login` or into the protected shell.

## Flow 2: Authenticated HTTP request (happy path)

1. A feature service (e.g. `UserManagementApiService`) calls `http.get(\`${config.backendUrl}/users\`)`.
2. `authInterceptor` runs first: clones the request with `withCredentials: true` (`interceptors/auth.interceptor.ts:15`) so the `connect.sid` (or equivalent) session cookie is attached.
3. `activityInterceptor` runs next: calls `SessionManagementService.recordActivity()` which updates `lastActivity = Date.now()` (`interceptors/activity.interceptor.ts:8-10`, `services/session-management.service.ts:45-47`).
4. Browser sends the request. Because the origin crosses `backendUrl`, the backend applies CORS with `credentials: true` (see `backend/.../cors/.docs/spec.md`).
5. Server returns 2xx; RxJS pipeline completes; caller receives the response body.

## Flow 3: 401 refresh-and-retry (single failing request)

1. Feature service issues a request; session cookie has expired server-side.
2. `authInterceptor` clones with `withCredentials: true`, `activityInterceptor` records activity.
3. Server responds `401`. The response URL does NOT contain `/auth/` (`auth.interceptor.ts:19`).
4. `handleUnauthorized` is invoked (`auth.interceptor.ts:27-55`). `isRefreshing` is `false`, so it flips to `true` and `refreshSubject.next(false)` closes the gate.
5. `SessionManagementService.refreshToken()` issues `POST ${backendUrl}/auth/refresh` with `withCredentials: true` (`session-management.service.ts:49-55`).
6. Server rotates the cookie and returns 2xx. `switchMap` sets `isRefreshing = false`, `refreshSubject.next(true)` releases the gate, and `next(req)` retries the original request (`auth.interceptor.ts:36-41`).
7. Retry succeeds (fresh cookie attached) and the original caller receives the response.

## Flow 4: Concurrent 401s — serialized refresh

1. Requests A, B, C are in flight simultaneously; all three return 401 at roughly the same time.
2. A enters `handleUnauthorized` first: sets `isRefreshing = true`, kicks off the single refresh (Flow 3, steps 4–5).
3. B and C enter `handleUnauthorized` while `isRefreshing` is still `true`. They take the else branch and subscribe to `refreshSubject`, filtering for `ready === true` and taking exactly one value (`auth.interceptor.ts:50-54`).
4. A's refresh succeeds. `refreshSubject.next(true)` fires. B and C pass the filter, unsubscribe, and each call `next(req)` to retry their original request.
5. All three requests ultimately complete after one network refresh.

## Flow 5: Refresh failure — forced logout

1. A non-auth request returns 401 (as in Flow 3).
2. `refreshToken()` is invoked but the server returns an error (refresh cookie expired / revoked).
3. The inner `catchError` sets `isRefreshing = false`, calls `sessionService.logout()`, and re-throws (`auth.interceptor.ts:42-46`).
4. `logout()` stops session timers, then issues `POST ${backendUrl}/auth/logout` with `withCredentials: true`. Both success and error handlers navigate to `/login` (`session-management.service.ts:57-65`).
5. The original caller sees the refresh error via the re-thrown `throwError`.
6. Any requests queued on `refreshSubject` remain blocked — they will resolve on the next `refreshSubject.next(true)`, which does not happen in this path. (See Discrepancies.)

## Flow 6: Auth route 401 passthrough

1. `AuthService.checkAuth()` calls `GET ${backendUrl}/auth/check` during `authGuard` execution.
2. Server returns 401 because there is no valid session cookie.
3. `authInterceptor` sees `req.url.includes('/auth/')` is true and short-circuits to `throwError(() => error)` (`auth.interceptor.ts:19,22`). No refresh, no retry.
4. `authGuard` observes the error and redirects to `/login` (per `keycloak-auth` feature).

## Flow 7: Proactive refresh and inactivity logout (when timers are active)

1. Something calls `SessionManagementService.startTimers()` (see Discrepancies — no caller exists in current source).
2. Every 4 minutes `refreshToken()` fires via `interval(REFRESH_INTERVAL_MS).subscribe(...)` (`session-management.service.ts:26-28`). The response is ignored by this timer.
3. Every 1 minute the inactivity check compares `Date.now() - lastActivity` against 30 min. If exceeded, `logout()` runs (`session-management.service.ts:31-35`).
4. Any HTTP request in the interval resets `lastActivity` via `activityInterceptor`, deferring logout.

## Flow 8: WebSocket connect / event stream / disconnect

1. A feature (e.g. `ChatService`) calls `wsClient.connect('agent')`.
2. Any prior socket is disconnected first (`websocket-client.service.ts:14-16`).
3. `io(\`${backendUrl}/agent\`, { transports: ['websocket','polling'], withCredentials: true })` opens a new socket; the session cookie is sent on the handshake (`websocket-client.service.ts:18-22`).
4. Caller subscribes to `wsClient.on<AgentMessage>('agent:message')`. The Observable factory registers `socket.on('agent:message', handler)` and emits via the subscriber; teardown calls `socket.off('agent:message', handler)` (`websocket-client.service.ts:24-38`).
5. Caller pushes messages with `wsClient.emit('agent:prompt', payload)`. If no socket is active, this throws (`websocket-client.service.ts:40-45`).
6. On component destroy, the caller invokes `wsClient.disconnect()` (or relies on `ngOnDestroy` of the singleton). `disconnect()` closes the socket and nulls the reference (`websocket-client.service.ts:47-50`).
