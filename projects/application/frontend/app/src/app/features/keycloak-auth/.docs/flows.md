# Keycloak Auth (Frontend) — Flows

All HTTP calls pass through `authInterceptor` which sets `withCredentials: true` and handles 401 refresh for non-`/auth/*` URLs (`features/api-client/interceptors/auth.interceptor.ts:12-25`). The activity interceptor resets the inactivity clock on every request (`interceptors/activity.interceptor.ts`).

## Flow 1: Login — Happy Path

1. User navigates to `/login`. Public route, `authGuard` does not run (`app.routes.ts:6-10`).
2. `LoginPage` renders; `LoginFormComponent` shows empty `username` + `password` fields (`login-form.component.ts:28-31`).
3. User fills both fields; `form.invalid` flips to false; submit button enables (`login-form.component.html:21`).
4. User clicks `Sign In`. `onSubmit()` checks `form.valid` and emits `submitCredentials` with `{ username, password }` (`login-form.component.ts:33-37`).
5. `LoginPage.onLogin` calls `AuthService.login(credentials)` (`login.page.ts:69-71`).
6. Service sets `_isLoading=true`, `_error=null`, then issues `POST {backendUrl}/auth/login` with body `{ username, password }` and `withCredentials: true` (`auth.service.ts:36-39`). The interceptor adds `withCredentials: true` again — redundant but harmless.
7. Backend returns `200 { message: "Login successful", user }` and sets `access_token` + `refresh_token` HTTP-only cookies (`backend/.../keycloak-auth/.docs/contracts.md`).
8. `next` handler sets `_user = response.user`, `_isLoading=false`, then `router.navigate(['/'])` (`auth.service.ts:41-45`).
9. Router hits the protected parent route; `authGuard` runs and sees `isAuthenticated()` true, admits the user; `/` redirects to `smoke-tests` (`app.routes.ts:19`).
10. `AuthService.permissions()` is computed locally from `user.roles` via `ROLE_PERMISSIONS`. The backend's `permissions` field from `/auth/check` is not used here because `login` only calls `/auth/login`.

## Flow 2: Login — Invalid Credentials

1. Steps 1–6 as above.
2. Backend returns `401 { statusCode, message: "Invalid credentials", error }`.
3. `error` handler sets `_error = err.error?.message ?? 'Login failed'` and `_isLoading=false` (`auth.service.ts:46-49`).
4. `LoginPage` template re-renders: the `@if (auth.error())` branch shows the message above the form (`login.page.ts:19-21`).
5. Form state is preserved — username and password values remain, validators untouched. User can edit and retry immediately.
6. No navigation occurs.

## Flow 3: Page Refresh with Valid Cookie (Session Revival)

1. User refreshes the page at, e.g., `/smoke-tests`.
2. App bootstraps; `provideAppInitializer` only runs `AppConfigService.load()` — it does NOT call `checkAuth` (`app.config.ts:17-20`).
3. Router starts resolving `/smoke-tests`; the protected parent route's `canActivate: [authGuard]` fires (`app.routes.ts:17`).
4. `authGuard` reads `auth.isAuthenticated()` — false, since `_user` is null on a fresh bootstrap.
5. Guard calls `auth.checkAuth()` which issues `GET {backendUrl}/auth/check` with credentials (`auth.service.ts:67-80`).
6. Backend validates the `access_token` cookie, returns `200 { authenticated: true, user, permissions }` (`backend/.../keycloak-auth/.docs/contracts.md`).
7. Service casts the response to `User` and sets `_user = response`. Because the response is actually wrapped, `_user.id`/`username`/`roles` are `undefined`; only `authenticated` and `user`/`permissions` keys exist on the stored value (see Discrepancies in `spec.md`). `isAuthenticated()` still becomes true because the object is non-null.
8. `authGuard` observes the emitted non-null value, returns true, route activates.

## Flow 4: Page Refresh Without / Expired Cookie

1. Steps 1–5 as above.
2. `GET /auth/check` returns 401 (guard is global on the backend; `/auth/check` is not `@Public`).
3. `authService.checkAuth()`'s `catchError` branch sets `_user = null` and emits `of(null)` (`auth.service.ts:74-78`). No error surfaces to the guard.
4. `authGuard` maps the null emission to `router.createUrlTree(['/login'])` (`auth.guard.ts:17-22`).
5. Router redirects; `/login` renders.

## Flow 5: Logout

1. User clicks `Logout` in the avatar menu (`features/app-header/components/avatar-menu/avatar-menu.component.ts:21` calls `auth.logout()`).
2. `AuthService.logout()` issues `POST {backendUrl}/auth/logout` with credentials (`auth.service.ts:53-64`).
3. Backend revokes the refresh token at Keycloak and clears both cookies; returns `200 { message: "Logout successful" }`.
4. On `complete`: set `_user = null`, navigate to `/login`.
5. If the request errors (network / 401): same cleanup — `_user = null` + navigate to `/login`. State is never left stale.

## Flow 6: 401 on a Protected API Call (Transparent Refresh)

1. User is on, e.g., `/admin/users`; `UserManagementApiService` issues `GET /users`.
2. Backend returns 401 because the `access_token` cookie is expired.
3. `authInterceptor.catchError` sees status 401 and URL does not contain `/auth/` (`auth.interceptor.ts:19-22`).
4. If no refresh is already in flight: `isRefreshing=true`, `refreshSubject.next(false)`, and call `SessionManagementService.refreshToken()` -> `POST /auth/refresh` (`auth.interceptor.ts:32-41`, `session-management.service.ts:49-55`).
5. Backend rotates cookies, returns 200. Interceptor clears the flag, emits `refreshSubject.next(true)`, and retries the original request (`auth.interceptor.ts:37-41`).
6. Any other requests that hit 401 while refreshing subscribe to `refreshSubject`, wait for `true`, then retry exactly once (`auth.interceptor.ts:50-54`).
7. If `/auth/refresh` itself fails, `catchError` calls `sessionService.logout()` which clears timers and navigates to `/login` (`auth.interceptor.ts:42-46`, `session-management.service.ts:57-65`).

## Flow 7: Proactive Refresh / Inactivity Timeout — currently dormant

1. `SessionManagementService.startTimers()` defines a 4-minute `interval` that calls `refreshToken()` and a 1-minute check that calls `logout()` if `Date.now() - lastActivity > 30 min` (`session-management.service.ts:22-36`).
2. `startTimers()` is NOT invoked anywhere in `src/` — there is no `ngOnInit` / login-success hook that calls it today. Only reactive 401-driven refresh (Flow 6) happens.
3. `activityInterceptor` still records activity on every request (`activity.interceptor.ts:7-11`), but with no inactivity timer running the value is unobserved.

## Flow 8: Permission-Gated UI via `RequirePermissionDirective`

1. A template author writes e.g. `<button *appRequirePermission="'users:read'">Create</button>`.
2. The directive's `effect()` runs, reads `auth.hasPermission('users:read')`, which reads the `permissions` computed signal (`require-permission.directive.ts:15-27`, `auth.service.ts:26-29,82-84`).
3. If true and view not yet created, `viewContainer.createEmbeddedView(templateRef)` renders the host template.
4. If the user's roles change later (e.g. after a future `checkAuth` that repopulates `_user`), the computed fires and the directive tears down or re-renders the view accordingly.
5. This is the only live permission check in the app today — route-level permission guarding (`permissionGuard`) exists but is not wired to any route.
