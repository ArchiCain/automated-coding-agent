# Auth Feature

**Feature directory:** `src/app/features/auth/`
**Page:** `/login` (public — outside the protected parent route)

## Purpose

Cookie-based authentication via Keycloak with permission-based access control. Provides session management, token refresh, guards, interceptors, a login page, and a single `provideAuth()` function to wire everything.

## Architecture

- **`provideAuth()`** — single function in `auth.provider.ts` that wires interceptors + APP_INITIALIZER. One call in `app.config.ts`.
- **`AuthService`** — session state via signals (`user()`, `permissions()`, `isAuthenticated()`), plus `hasPermission()` / `hasPermission$()` for permission checks, `login()`, `logout()`, `checkSession()`, `refreshToken()`.
- **`authGuard`** — route guard on the parent route. All child routes inherit. Redirects to `/login`.
- **`permissionGuard(perm)`** — factory function for permission-based route protection. Redirects to `/home` (not `/login` — user is authenticated but unauthorized).
- **`credentialsInterceptor`** — adds `withCredentials: true` to every request.
- **`authErrorInterceptor`** — 401 refresh with retry queue (prevents concurrent refresh calls), 403 snackbar, 5xx snackbar.

## Login Page

Full-page centered card layout (no sidenav). Email + password form.

- "Sign In" heading, no branding
- Email field (Keycloak uses email as username) with `appearance="outline"`
- Password field with `appearance="outline"`
- "Sign In" button — `mat-flat-button color="primary"`, full width
- Loading spinner on button while request is in flight
- Error message below form on 401
- On success: stores user + permissions in signals, redirects to `/home`
- If already authenticated, redirect to `/home` immediately
- Form validation: both fields required, email validates format

## Constraints

- Tokens are in HTTP-only cookies — frontend NEVER accesses them directly
- `withCredentials: true` is required on every request (handled globally by interceptor)
- Permission checks on the frontend are UX-only — backend enforces via `@RequirePermission()`
- Permissions are resolved server-side from roles — frontend never maps roles to permissions
- `checkSession()` silently returns null on failure — never blocks app bootstrap
- Login calls `checkSession()` after POST to load permissions (POST response doesn't include them)

## Portability

To use in another Angular project:
1. Copy `features/auth/` directory
2. Add `provideAuth()` to `app.config.ts`
3. Add login route outside the protected parent route
4. Add `authGuard` to the protected parent route
5. Use `permissionGuard(perm)` on routes needing specific permissions

## Acceptance Criteria

### Auth Infrastructure
- [ ] `provideAuth()` wires everything in one call
- [ ] Session restores on page refresh via `/auth/check`
- [ ] Permissions loaded from server, not mapped client-side
- [ ] 401 triggers token refresh with retry queue
- [ ] 403 shows snackbar "Access denied"
- [ ] 5xx shows snackbar "Something went wrong"
- [ ] `permissionGuard('users:read')` blocks unauthorized routes (redirects to /home)

### Login Page
- [ ] Full-page centered card, dark background (#121212), card surface (#1e1e1e)
- [ ] `mat-form-field` with `appearance="outline"`, default border-radius
- [ ] Sign In button clearly visible against card
- [ ] Error message on failed login, form fields NOT cleared
- [ ] Loading spinner on button during request
- [ ] Does NOT store tokens in localStorage
- [ ] Redirects to /home on success
- [ ] Redirects to /home if already authenticated
