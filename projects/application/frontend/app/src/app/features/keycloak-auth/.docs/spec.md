# Keycloak Auth (Frontend) — Spec

## Purpose

Angular consumer of the backend `/auth/*` endpoints (`projects/application/backend/app/src/features/keycloak-auth/`). Holds signal-based session state, drives the `/login` page, gates the protected route tree with `authGuard`, and provides a declarative permission check for templates (`RequirePermissionDirective`). Tokens live in HTTP-only cookies set by the backend; the frontend never reads or stores them. Cross-cutting 401/refresh and activity logic lives in `@features/api-client` interceptors (`src/app/app.config.ts:15`), not here.

## Behavior

### `AuthService` (`services/auth.service.ts:13`)
- `providedIn: 'root'` singleton. All HTTP uses `${AppConfigService.backendUrl}/auth` as the base.
- Private signals `_user`, `_isLoading`, `_error`; exposed as `user`, `isLoading`, `error` via `.asReadonly()` (`auth.service.ts:18-24`).
- `isAuthenticated = computed(() => _user() !== null)` (`auth.service.ts:25`).
- `permissions = computed(...)` — resolves the current user's permissions LOCALLY via `getPermissionsForRoles(user.roles)` (`auth.service.ts:26-29`, `permissions/permissions.config.ts:17-26`). The `/auth/check` response is NOT consulted for permissions even though the backend returns one.
- `login({ username, password })` — fires `POST /auth/login` with `withCredentials: true`. On 200 stores `response.user` and navigates to `/`; on error sets `error()` to `err.error?.message ?? 'Login failed'` (`auth.service.ts:35-51`).
- `logout()` — fires `POST /auth/logout`. On both `complete` and `error` it clears `_user` and navigates to `/login` (`auth.service.ts:53-65`).
- `checkAuth(): Observable<User | null>` — fires `GET /auth/check`, types the response as `User` and stores it. On any HTTP error it returns `of(null)` without surfacing an error (`auth.service.ts:67-80`). Known contract drift: the backend actually returns `{ authenticated, user, permissions }` (`backend/.../keycloak-auth/.docs/contracts.md`); the FE strips everything but top-level fields since it treats the whole body as `User`, so `username`, `roles`, etc. are left `undefined` on the resulting object. See Discrepancies.
- `hasPermission(p)` — delegates to the pure helper on the computed `permissions()` (`auth.service.ts:82-84`).

### Login page (`pages/login.page.ts`)
- Standalone component `app-login-page`, `ChangeDetectionStrategy.OnPush` (`login.page.ts:8-65`).
- Centered `mat-card`, max-width 440px, `padding: 32px`, `border-radius: 12px`, 600ms slide-up-fade-in honoring `prefers-reduced-motion` (`login.page.ts:27-62`).
- Card header `Sign In` / subtitle `RTS AI Platform`. Body shows `auth.error()` above the form when set (`login.page.ts:19-21`).
- Hosts `<app-login-form>` and calls `auth.login(credentials)` on `submitCredentials` (`login.page.ts:69-71`).
- Does NOT redirect if the user is already authenticated; the form and card render regardless.

### Login form (`components/login-form/login-form.component.ts`)
- Reactive form with two controls (`login-form.component.ts:28-31`):
  - `username` — `Validators.required`, `Validators.minLength(3)`. Labelled `Username`, `autocomplete="username"` (`login-form.component.html:3-11`).
  - `password` — `Validators.required`. `type="password"`, `autocomplete="current-password"` (`login-form.component.html:13-19`).
- Submit is a `mat-flat-button` disabled while `form.invalid` (`login-form.component.html:21-23`). No loading spinner or input disabling while an auth request is in flight.
- No email-format validation; the field is `input`/text and accepts any string of length 3+.
- Emits `submitCredentials: LoginCredentials` via `output<T>()` — `username` + `password`, never `email` (`login-form.component.ts:26,35`, `types.ts:10-13`).
- Inline field errors: "Username is required", "Username must be at least 3 characters", "Password is required" — all via `@if` + `mat-error` (`login-form.component.html:5-18`).

### `authGuard` (`guards/auth.guard.ts`)
- `CanActivateFn` applied on the protected parent route in `app.routes.ts:17`.
- If `AuthService.isAuthenticated()` is true, returns true immediately.
- Otherwise calls `AuthService.checkAuth()` (`GET /auth/check`) and maps: truthy user -> true, otherwise `router.createUrlTree(['/login'])` (`auth.guard.ts:7-24`).
- This is the sole mechanism for session revival on page refresh — there is no `provideAppInitializer` calling `checkAuth()` (verified in `app.config.ts:11-22`).

### `permissionGuard` (`guards/permission.guard.ts`) — defined but not wired
- Factory returning a `CanActivateFn` that returns true when `auth.hasPermission(perm)`, else redirects via `router.createUrlTree(['/'])` (`permission.guard.ts:7-18`).
- Not applied to any route. The `app.routes.ts` tree applies `authGuard` only; `admin/users`, `admin/users/new`, `admin/users/:id` have no permission gate at the router level (`app.routes.ts:26-39`).

### `RequirePermissionDirective` (`directives/require-permission.directive.ts`) — the only active permission check
- Structural directive `*appRequirePermission="'users:read'"`. Renders the host template when `auth.hasPermission(permission)` is true, clears it otherwise, via an `effect()` on the signal-backed permission check (`require-permission.directive.ts:15-27`).
- Exported from `index.ts:5` and re-exported via `KeycloakAuthModule` (`keycloak-auth.module.ts:7-8`).
- Currently NOT referenced in any template in `src/` — ready for use but unused today (verified by grep).

### Permissions model (`permissions/permissions.types.ts`, `permissions/permissions.config.ts`)
- `Permission` union: `users:read | users:write | users:delete | conversations:read | conversations:write | conversations:delete | admin:access` (`permissions.types.ts:1-8`). Differs from backend which uses `users:create|update|delete` and `conversations:create|delete` (see Discrepancies).
- `Role` union: `admin | user | viewer` (`permissions.types.ts:10`). Backend realm has only `admin` and `user`.
- `ROLE_PERMISSIONS`: admin -> all 7, user -> `conversations:{read,write,delete}`, viewer -> `conversations:read` (`permissions.config.ts:3-15`).
- Helpers: `getPermissionsForRoles(roles)` unions unknown-role-tolerantly; `hasPermission(perms, required)` is a pure includes check (`permissions.config.ts:17-30`).

### Cross-cutting behavior delegated to `@features/api-client`
- `authInterceptor` (`features/api-client/interceptors/auth.interceptor.ts:12-25`) sets `withCredentials: true` on every request; on 401 for any non-`/auth/*` URL it calls `SessionManagementService.refreshToken()` (`POST /auth/refresh`), queues concurrent 401s on a `BehaviorSubject`, retries the original request on success, and on refresh failure triggers `sessionService.logout()`.
- `activityInterceptor` (`interceptors/activity.interceptor.ts`) calls `SessionManagementService.recordActivity()` on every request.
- `SessionManagementService.startTimers()` starts a 4-minute proactive `POST /auth/refresh` loop and a 30-minute inactivity logout check (`session-management.service.ts:8-36`). It is NOT called from anywhere in `src/` today — the timers are dormant unless something starts them.

## Components / Services / Guards / Directives

| Kind | Name | Source |
|---|---|---|
| Service | `AuthService` | `services/auth.service.ts:13` |
| Page | `LoginPage` (`app-login-page`) | `pages/login.page.ts:8` |
| Component | `LoginFormComponent` (`app-login-form`) | `components/login-form/login-form.component.ts:10` |
| Guard | `authGuard` (applied in `app.routes.ts:17`) | `guards/auth.guard.ts:7` |
| Guard | `permissionGuard(perm)` — factory, unwired | `guards/permission.guard.ts:7` |
| Directive | `RequirePermissionDirective` (`[appRequirePermission]`) — unused | `directives/require-permission.directive.ts:6` |
| Types | `User`, `LoginCredentials`, `AuthState` | `types.ts` |
| Permissions | `Permission`, `Role`, `ROLE_PERMISSIONS`, `getPermissionsForRoles`, `hasPermission` | `permissions/*.ts` |
| Module barrel | `KeycloakAuthModule` (re-exports standalones) | `keycloak-auth.module.ts`, `index.ts` |

## Acceptance Criteria

- [ ] `/login` renders a centered card with `Sign In` / `RTS AI Platform` header and the login form; route is public and sits outside the `authGuard`-protected tree (`app.routes.ts:6-10`).
- [ ] Login form submits `{ username, password }` (never `email`) and is disabled while invalid.
- [ ] Username field enforces required + min-length 3; password field enforces required; errors appear only after touch.
- [ ] On 200, `AuthService.user()` becomes the returned `user` object and the router navigates to `/`.
- [ ] On 401, `AuthService.error()` is set to the server message (falling back to `'Login failed'`); form values are preserved.
- [ ] `AuthService.logout()` clears the user and navigates to `/login` whether the logout HTTP call succeeds or errors.
- [ ] `authGuard` returns true when `isAuthenticated()` is true; otherwise calls `checkAuth()` and either admits or redirects to `/login`.
- [ ] `AuthService.permissions()` is computed from the current user's `roles` via local `ROLE_PERMISSIONS` (NOT from the `/auth/check` permissions field).
- [ ] `RequirePermissionDirective` renders/clears its template based on `AuthService.hasPermission(permission)` and reacts to signal changes.
- [ ] `permissionGuard(perm)` is exported and callable but is NOT applied to any route — admin/users routes currently pass any authenticated user.
- [ ] Every `/auth/*` request runs through `authInterceptor` which sets `withCredentials: true` and excludes `/auth/*` URLs from its 401-refresh branch.
