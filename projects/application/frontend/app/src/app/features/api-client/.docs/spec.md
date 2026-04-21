# API Client — Requirements

**Feature directory:** `src/app/features/api-client/`

## What It Does

Core infrastructure for backend communication. Provides runtime configuration loading, HTTP interceptors for auth and activity tracking, session management with proactive token refresh, and a generic WebSocket client.

## Services

| Service | Purpose |
|---|---|
| `AppConfigService` | Loads `/config.json` at startup via `APP_INITIALIZER`. Exposes `backendUrl` getter. Throws if config not loaded or keys missing. |
| `SessionManagementService` | Manages auth session lifecycle: proactive token refresh (every 4 min), inactivity logout (30 min), `recordActivity()`, `refreshToken()`, `logout()`. |
| `WebSocketClientService` | Generic Socket.IO wrapper. `connect(namespace)`, `on<T>(event)` (returns Observable), `emit(event, data)`, `disconnect()`. |

## Interceptors

| Interceptor | Purpose |
|---|---|
| `authInterceptor` | Adds `withCredentials: true` to all requests. On 401 (non-auth routes): refreshes token with retry queue to prevent concurrent refreshes, then retries the failed request. On refresh failure: logs out. |
| `activityInterceptor` | Calls `SessionManagementService.recordActivity()` on every HTTP request to reset the inactivity timer. |

## Types

- `AppConfig` — `{ backendUrl: string }`
- `ApiError` — `{ statusCode: number; message: string; error?: string }`

## Architecture

- `AppConfigService` loads config via `fetch()` (not HttpClient) to avoid circular dependency with interceptors.
- `authInterceptor` uses a `BehaviorSubject` as a refresh gate: concurrent 401s queue behind the single in-flight refresh.
- `SessionManagementService` is `providedIn: 'root'` and starts timers externally via `startTimers()`.
- `WebSocketClientService` wraps Socket.IO and exposes events as RxJS Observables.

## Acceptance Criteria

### App Config
- [ ] `/config.json` loaded at startup before app renders
- [ ] Missing required keys cause a thrown error with descriptive message
- [ ] `backendUrl` getter throws if config not yet loaded

### Auth Interceptor
- [ ] All requests include `withCredentials: true`
- [ ] 401 on non-auth routes triggers token refresh
- [ ] Concurrent 401s queue behind a single refresh call
- [ ] Refresh failure triggers logout and redirect to `/login`
- [ ] Auth routes (`/auth/*`) are excluded from retry logic

### Session Management
- [ ] Token refreshes proactively every 4 minutes
- [ ] Inactivity logout after 30 minutes of no HTTP requests
- [ ] `recordActivity()` resets the inactivity timer
- [ ] `logout()` stops timers, calls backend logout, redirects to `/login`

### WebSocket Client
- [ ] Connects to `{backendUrl}/{namespace}` with WebSocket + polling transports
- [ ] `on()` returns Observable that unsubscribes listener on teardown
- [ ] `emit()` throws if not connected
- [ ] `disconnect()` cleans up socket
