# API Client — Spec

**Feature directory:** `src/app/features/api-client/`

## Purpose

Core infrastructure feature that every other frontend feature depends on for backend I/O. Provides: (1) a runtime configuration loader that fetches `/config.json` before the app renders, (2) a base-URL accessor (`backendUrl`) used by all HTTP and WebSocket callers, (3) the `authInterceptor` / `activityInterceptor` pair registered once in `app.config.ts:15`, (4) a `SessionManagementService` for proactive token refresh and inactivity logout, and (5) a generic Socket.IO wrapper. This feature is the sole place `withCredentials`, the `/auth/refresh` retry queue, and the cookie-based session lifecycle are implemented.

## Behavior

### Runtime config
- `AppConfigService.load()` is awaited by `provideAppInitializer` before any component renders (`src/app/app.config.ts:17-20`).
- `load()` does `fetch('/config.json', { cache: 'no-store' })` — deliberately NOT `HttpClient`, to avoid the interceptor circular dependency (`services/app-config.service.ts:25`).
- Non-2xx response throws `Failed to load /config.json (<status>). Ensure config.json is served by nginx or the dev server.` (`app-config.service.ts:26-31`).
- Missing or empty `backendUrl` throws `Missing required config keys in /config.json: backendUrl. ...` (`app-config.service.ts:35-41`).
- The `backendUrl` getter throws `App config not loaded. Ensure APP_INITIALIZER completed.` if accessed before `load()` resolves (`app-config.service.ts:16-22`).
- Shipped default in `public/config.json` is `{ "backendUrl": "/api" }`; the deployed image rewrites it at container start.

### HTTP request pipeline
Every `HttpClient` call funnels through two interceptors registered in order `[authInterceptor, activityInterceptor]` (`app.config.ts:15`):
- `authInterceptor` clones the request with `withCredentials: true` so the session cookie is attached (`interceptors/auth.interceptor.ts:15`). This makes the request eligible for the CORS `credentials: true` path on the backend (`backend/app/src/features/cors/.docs/spec.md`).
- On a `401 Unauthorized` response **for any URL that does not contain `/auth/`**, the interceptor triggers a single `POST {backendUrl}/auth/refresh` and retries the original request (`auth.interceptor.ts:19`).
- Concurrent 401s are serialized via a module-scoped `BehaviorSubject<boolean>` gate (`auth.interceptor.ts:9,32-54`): the first 401 flips `isRefreshing = true` and starts the refresh; later 401s wait on the subject, then retry once it emits `true`.
- If `/auth/refresh` itself fails, `SessionManagementService.logout()` is called and the error is re-thrown (`auth.interceptor.ts:42-46`).
- 401s on URLs containing `/auth/` (e.g. `/auth/login`, `/auth/check`) are passed through unmodified — no refresh attempt (`auth.interceptor.ts:19`).
- `activityInterceptor` calls `SessionManagementService.recordActivity()` on every outbound request (`interceptors/activity.interceptor.ts:7-11`).

### Session lifecycle
- `SessionManagementService.startTimers()` (when invoked) starts two `rxjs.interval` subscriptions: a 4-minute proactive refresh and a 1-minute inactivity check with a 30-minute threshold (`services/session-management.service.ts:22-36`).
- `recordActivity()` writes `Date.now()` to an internal `lastActivity` field (`session-management.service.ts:45-47`).
- Inactivity tick: if `Date.now() - lastActivity > 30 min`, `logout()` is invoked (`session-management.service.ts:31-35`).
- `refreshToken()` emits `POST {backendUrl}/auth/refresh` with `withCredentials: true` (`session-management.service.ts:49-55`).
- `logout()` stops timers, emits `POST {backendUrl}/auth/logout` with `withCredentials: true`, then navigates to `/login` on both success and error (`session-management.service.ts:57-65`).
- `ngOnDestroy` stops timers (`session-management.service.ts:67-69`).

### WebSocket
- `WebSocketClientService.connect(namespace)` opens a Socket.IO connection to `${backendUrl}/${namespace}` with `transports: ['websocket', 'polling']` and `withCredentials: true` (`services/websocket-client.service.ts:13-22`). An existing socket is disconnected first.
- `on<T>(event)` returns an `Observable<T>` whose teardown calls `socket.off(event, handler)`; it emits an error if the socket is not connected (`websocket-client.service.ts:24-38`).
- `emit(event, data)` throws `Error("WebSocket not connected")` when there is no active socket (`websocket-client.service.ts:40-45`).
- `disconnect()` calls `socket.disconnect()` and clears the reference; `ngOnDestroy` delegates to `disconnect()` (`websocket-client.service.ts:47-54`).

## Components / Services

| Export | Kind | Source | Role |
|---|---|---|---|
| `AppConfigService` | `@Injectable({ providedIn: 'root' })` | `services/app-config.service.ts:12` | Fetches `/config.json`, exposes `backendUrl` getter, signal-backed `config`. |
| `SessionManagementService` | `@Injectable({ providedIn: 'root' })` | `services/session-management.service.ts:13` | Refresh + inactivity timers, `recordActivity`, `refreshToken`, `logout`. |
| `WebSocketClientService` | `@Injectable({ providedIn: 'root' })` | `services/websocket-client.service.ts:9` | Socket.IO wrapper: `connect/on/emit/disconnect`. |
| `authInterceptor` | `HttpInterceptorFn` | `interceptors/auth.interceptor.ts:12` | `withCredentials` + 401 refresh-and-retry queue. |
| `activityInterceptor` | `HttpInterceptorFn` | `interceptors/activity.interceptor.ts:7` | Resets inactivity timer on every request. |
| `ApiClientModule` | empty `@NgModule` | `api-client.module.ts:4` | Placeholder re-export barrel; no declarations. |
| `AppConfig` | interface | `services/app-config.service.ts:4-6` | `{ backendUrl: string }`. |
| `ApiError` | interface | `types.ts:2-6` | `{ statusCode: number; message: string; error?: string }`. |

## Runtime Configuration

| Key | Source | Default | Consumers |
|---|---|---|---|
| `backendUrl` | `public/config.json` -> fetched at bootstrap | `/api` | All `*.api.ts` services, `ThemeService`, `ChatService`, `AppConfigService`, `SessionManagementService`, `WebSocketClientService` |

## Acceptance Criteria

- [ ] `/config.json` is fetched with `cache: 'no-store'` and completes before the root component renders.
- [ ] `backendUrl` getter throws when called before `load()` resolves.
- [ ] `load()` throws a descriptive error on non-2xx response or when required keys are missing/empty.
- [ ] `AppConfigService` never uses `HttpClient` (avoids interceptor cycle).
- [ ] Every HTTP request leaving the app has `withCredentials: true`.
- [ ] Any 401 on a non-`/auth/` URL triggers exactly one `POST /auth/refresh`, even with concurrent in-flight requests.
- [ ] After a successful refresh, the original failing request is retried and subsequent queued requests are released.
- [ ] Failed refresh triggers `logout()` which calls `POST /auth/logout`, stops timers, and navigates to `/login`.
- [ ] 401s on `/auth/*` URLs propagate to the caller without refresh attempts.
- [ ] `activityInterceptor` runs on every request and updates `lastActivity`.
- [ ] `SessionManagementService.startTimers()` refreshes every 4 min and logs out after 30 min of inactivity.
- [ ] `WebSocketClientService.connect(ns)` produces a single socket at `${backendUrl}/${ns}` with WS + polling transports and `withCredentials: true`.
- [ ] `on<T>(event)` unsubscribes the underlying socket listener on Observable teardown.
- [ ] `emit` / `on` without an active socket error out rather than silently no-oping.
