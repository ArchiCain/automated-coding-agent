# Keycloak Auth (Frontend) — Test Plan

Credentials and realm details in `test-data.md`. Every contract test maps to a call listed in `contracts.md`; every behavior test maps to an acceptance criterion in `spec.md`.

## Contract Tests (`AuthService` -> backend `/auth/*`)

- [ ] `POST /auth/login` with body `{ username, password }` and `withCredentials: true` — verify the request body keys (`username`, NOT `email`).
- [ ] `POST /auth/login` 200 response maps `response.user` onto `AuthService.user()`; `message` is discarded.
- [ ] `POST /auth/login` 401 error: `AuthService.error()` equals `err.error.message` when present, otherwise `'Login failed'`.
- [ ] `POST /auth/logout` sends empty body `{}` with credentials; `AuthService.user()` is cleared on both success and error.
- [ ] `GET /auth/check` sends credentials, no body. On 200 the returned body is stored on `_user`; on any HTTP error the signal is cleared and `of(null)` is emitted (never throws).
- [ ] All `/auth/*` URLs are skipped by `authInterceptor`'s 401-refresh branch (`auth.interceptor.ts:19`).

## Behavior Tests — `AuthService`

- [ ] `isAuthenticated()` is false before any login and true after a successful login.
- [ ] `permissions()` is `[]` when `user()` is null; for a user with `roles: ['admin']` returns all 7 FE permissions.
- [ ] `permissions()` uses the FE `ROLE_PERMISSIONS` map, NOT the `permissions` array from `/auth/check`.
- [ ] `hasPermission(p)` is a pure `.includes` check over `permissions()`.
- [ ] `login` navigates to `/` on success; does not navigate on error.
- [ ] `logout` always navigates to `/login` (success or error branch).

## Behavior Tests — Login page & form

- [ ] `/login` renders outside `authGuard`; accessible when `user()` is null.
- [ ] Form submit button is disabled while `form.invalid`; enables only when both fields satisfy their validators.
- [ ] Username required + min length 3: typing 2 chars and blurring shows "Username must be at least 3 characters"; empty + touched shows "Username is required".
- [ ] Password required + touched shows "Password is required".
- [ ] There is NO email-format validator; `notanemail` with a password is an accepted submission.
- [ ] On submit, `submitCredentials` emits `{ username, password }` with current form values.
- [ ] After a 401, `auth.error()` text renders above the form and the form inputs retain their values.
- [ ] Already-authenticated users who navigate to `/login` see the login form (no auto-redirect) — this is the current behavior.

## Behavior Tests — Guards

- [ ] `authGuard` on the protected parent returns true when `isAuthenticated()` is true and does NOT issue `GET /auth/check`.
- [ ] `authGuard` with `isAuthenticated()` false issues `GET /auth/check`, admits on truthy user, redirects to `/login` via a `UrlTree` on null.
- [ ] `permissionGuard('users:read')` returns true when the signed-in user's roles include `admin` (via FE `ROLE_PERMISSIONS`) and a `UrlTree` to `/` otherwise.
- [ ] `permissionGuard` is NOT applied to `admin/users*` routes — a `user`-role user can reach those pages today (`app.routes.ts:26-39`).

## Behavior Tests — `RequirePermissionDirective`

- [ ] `*appRequirePermission="'users:read'"` renders the host element when the current user's FE permissions include `users:read`, and clears it when not.
- [ ] When `AuthService.user()` transitions null -> admin user, the directive's `effect()` creates the embedded view.
- [ ] When it transitions admin -> null (logout), the directive clears the view.
- [ ] The directive is currently unreferenced by any template — this test suite runs against fixture hosts.

## Integration / E2E

- [ ] Happy path: visit `/login`, submit `testuser` / `password`, land on `/smoke-tests`; `AuthService.user().username === 'testuser'` after login.
- [ ] Admin path: submit `admin` / `admin`; `permissions()` contains `users:read`.
- [ ] Page refresh with valid session: reload `/smoke-tests`; `authGuard` calls `/auth/check`; page re-renders without bouncing to `/login`.
- [ ] Page refresh with no session: clear cookies, reload a protected route; redirected to `/login`.
- [ ] Logout via avatar menu: `Logout` click returns to `/login`; subsequent refresh of a protected URL bounces to `/login`.
- [ ] 401 on a protected API call triggers one `POST /auth/refresh` and retries the original request (success path); on refresh failure logs out and returns to `/login`.
