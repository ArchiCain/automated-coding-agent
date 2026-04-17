# Auth Feature

**Feature directory:** `src/app/features/auth/`

## Purpose

Cookie-based authentication via Keycloak with permission-based access control. Provides session management, token refresh, guards, interceptors, and a single `provideAuth()` function to wire everything.

## Public API

| Export | Type | Purpose |
|--------|------|---------|
| `provideAuth()` | function | Wires interceptors + APP_INITIALIZER — one call in `app.config.ts` |
| `AuthService` | service | Session state, login, logout, refresh, permission checks |
| `authGuard` | guard | Route guard: is user authenticated? |
| `permissionGuard(perm)` | guard factory | Route guard: does user have this permission? |
| `credentialsInterceptor` | interceptor | Adds `withCredentials: true` to all requests |
| `authErrorInterceptor` | interceptor | 401 refresh+retry queue, 403/5xx snackbar |
| `LoginPage` | component | Ready-made login page |
| Auth types | interfaces | `AuthUser`, `AuthCheckResponse`, `LoginRequest`, `LoginResponse` |

## AuthService Signals

| Signal/Computed | Type | Purpose |
|-----------------|------|---------|
| `user()` | `AuthUser \| null` | Current user profile, null if not authenticated |
| `permissions()` | `string[]` | Resolved permissions from backend |
| `isAuthenticated()` | `boolean` | Computed: user is not null |

## AuthService Methods

| Method | Purpose | Returns |
|--------|---------|---------|
| `hasPermission(perm)` | Imperative permission check (guards, logic) | `boolean` |
| `hasPermission$(perm)` | Reactive permission check (templates) | `Signal<boolean>` |
| `login(username, password)` | POST /auth/login, then checkSession for permissions | `Observable<AuthUser>` |
| `logout()` | POST /auth/logout, clear state | `Observable<void>` |
| `checkSession()` | GET /auth/check, load user + permissions | `Observable<AuthUser \| null>` |
| `refreshToken()` | POST /auth/refresh | `Observable<boolean>` |

## Constraints

- Tokens are in HTTP-only cookies — frontend NEVER accesses them directly
- `withCredentials: true` is required on every request (handled by `credentialsInterceptor`)
- Permission checks on the frontend are UX-only — backend enforces via `@RequirePermission()`
- Permissions are resolved server-side from roles — frontend never maps roles to permissions
- `checkSession()` silently returns null on failure — it never blocks app bootstrap
- Login calls `checkSession()` after the POST to load permissions (the POST response doesn't include permissions)

## Portability

To use in another Angular project:
1. Copy `features/auth/` directory
2. Add `provideAuth()` to `app.config.ts`
3. Add login route outside the protected parent route
4. Add `authGuard` to the protected parent route
5. Use `permissionGuard(perm)` on routes that need specific permissions
6. Use `authService.hasPermission$(perm)` in templates for conditional UI
