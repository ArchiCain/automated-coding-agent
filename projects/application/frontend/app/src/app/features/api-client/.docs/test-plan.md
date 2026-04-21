# API Client — Test Plan

## AppConfigService

- [ ] `/config.json` loaded at startup before app renders (via APP_INITIALIZER)
- [ ] Missing required keys cause thrown error with descriptive message
- [ ] `backendUrl` getter throws if config not yet loaded
- [ ] Uses `fetch()` (not HttpClient) to avoid circular dependency

## Auth Interceptor

- [ ] All requests include `withCredentials: true`
- [ ] 401 on non-auth routes triggers token refresh
- [ ] Concurrent 401s queue behind a single refresh call (BehaviorSubject gate)
- [ ] After refresh succeeds, all queued requests retry
- [ ] Refresh failure triggers logout and redirect to `/login`
- [ ] Auth routes (`/auth/*`) are excluded from retry logic

## Session Management Service

- [ ] Token refreshes proactively every 4 minutes
- [ ] Inactivity logout after 30 minutes of no HTTP requests
- [ ] `recordActivity()` resets the inactivity timer
- [ ] `logout()` stops all timers, calls backend logout, redirects to `/login`
- [ ] `startTimers()` must be called externally to begin tracking

## Activity Interceptor

- [ ] Calls `SessionManagementService.recordActivity()` on every HTTP request

## WebSocket Client Service

- [ ] Connects to `{backendUrl}/{namespace}` with WebSocket + polling transports
- [ ] `on<T>(event)` returns Observable that unsubscribes listener on teardown
- [ ] `emit(event, data)` throws if not connected
- [ ] `disconnect()` cleans up socket
