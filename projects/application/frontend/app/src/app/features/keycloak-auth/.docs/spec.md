# Keycloak Auth (Frontend) — Spec

## What it is

Sign-in, session, and permission surface for the frontend. Provides the `/login` page, holds the current user and their permissions in memory, gates the protected route tree, revives a session on page refresh, and exposes a declarative way for templates to show or hide UI based on what the signed-in user is allowed to do. Tokens live in HTTP-only cookies set by the backend; the frontend never reads or stores them.

## How it behaves

### Signing in

A user who is not signed in lands on `/login`, which renders a centered card titled "Sign In" with subtitle "AI Platform" and a form asking for a username and password. The form validates locally: username is required and must be at least three characters; password is required. The submit button stays disabled while the form is invalid. On submit, the frontend posts the credentials to the backend with cookies enabled. If the backend accepts them, the returned user is stored in memory and the user is sent to `/`. If the backend rejects them, the server's error message is shown above the form (falling back to "Login failed" when the server gives nothing); the values the user typed are preserved. There is no loading spinner or input-disabling while the request is in flight, and the page does not redirect a user who is already signed in — the login card renders regardless.

### Staying signed in across a page refresh

When the user reloads the page, the protected route tree defers to the backend: if in-memory state already shows a signed-in user the route admits immediately; otherwise the frontend asks the backend who the caller is (`GET /auth/check`), stores the result as the current user, and admits them — or, if the backend says no one is signed in, redirects to `/login`. This route-time check is the only mechanism for session revival; there is no app-initializer running it on boot (verified in `app.config.ts:11-22`).

### Signing out

Triggering logout posts to the backend and, regardless of whether that call succeeds or errors, clears the current user from memory and navigates to `/login`.

### Hitting a protected route

All routes under the protected parent require a signed-in user (`app.routes.ts:17`). An unauthenticated visitor is bounced to `/login`. No route currently enforces a permission beyond "signed in" — see Known gaps.

### Checking permissions in templates

Templates can wrap any element in a structural directive that takes a permission name; the element renders when the current user has that permission and disappears when they don't, reacting live to changes in the signed-in user. Permissions are derived locally from the user's roles using a frontend-defined role-to-permissions map (`permissions/permissions.config.ts:3-15`); the permissions field in the backend's `/auth/check` response is ignored.

## Acceptance criteria

- `/login` renders a centered card with header "Sign In" and subtitle "AI Platform" and is publicly reachable outside the protected route tree.
- The login form submits username and password (never email) and its submit button is disabled while the form is invalid.
- Username enforces required + min-length 3; password enforces required; field errors appear only after the field is touched.
- On a successful login, the current user becomes the user object returned by the backend and the router navigates to `/`.
- On a failed login, the error message from the server is shown above the form (falling back to "Login failed"), and the form keeps the values the user typed.
- Logout clears the current user and navigates to `/login` whether the logout HTTP call succeeds or errors.
- On a protected route, an already-signed-in user is admitted immediately; an unknown user triggers a backend identity check and is either admitted (if the backend recognizes them) or redirected to `/login`.
- The current user's permissions are computed from their roles via the frontend's local role-to-permissions map, not from the backend's response body.
- The permission directive renders its host element when the current user has the named permission and removes it otherwise, updating when the user changes.
- Every outbound request is sent with cookies; `/auth/*` URLs are exempt from the 401-refresh retry branch.

## Known gaps

- The route-level permission guard is defined and exported but is not applied to any route; admin routes (`admin/users`, `admin/users/new`, `admin/users/:id`) currently admit any authenticated user regardless of permission (`guards/permission.guard.ts:7-18`, `app.routes.ts:26-39`).
- The permission directive is exported and ready to use but is referenced in zero templates today (verified by grep) — the "show/hide by permission" surface is effectively dormant (`directives/require-permission.directive.ts:6`).
- Session revival types the `/auth/check` response as `User`, but the backend actually returns `{ authenticated, user, permissions }`. The frontend keeps the whole body as if it were the user, so after revival the stored user is missing `username`, `roles`, and other fields, and the computed permissions collapse to `[]` (`services/auth.service.ts:67-80`, backend `keycloak-auth/.docs/contracts.md`).
- The proactive-refresh and inactivity-logout timers in `SessionManagementService.startTimers()` are never called from anywhere in `src/`, so the 4-minute refresh loop and 30-minute inactivity check are dormant today (`session-management.service.ts:8-36`).
- The frontend's `Permission` union uses `users:write` and includes `admin:access`, while the backend uses `users:create` / `users:update` and has no `admin:access` permission; the frontend's `Role` union adds `viewer`, which the backend realm does not define (`permissions/permissions.types.ts:1-10`).
- `LoginCredentials` is `{ username, password }`, not `{ email, password }`; the login field is a plain text input with no email-format validation (`types.ts:10-13`, `components/login-form/login-form.component.html:3-11`).
- `withCredentials: true` is set twice on every auth request — once in the auth service's HTTP calls and again in the shared auth interceptor — which is redundant (`services/auth.service.ts:35-51`, `features/api-client/interceptors/auth.interceptor.ts:12-25`).

## Code map

Paths relative to `projects/application/frontend/app/`.

| Concern | File · lines |
|---|---|
| Current user + loading/error state (signals, read-only views) | `src/app/features/keycloak-auth/services/auth.service.ts:18-24` |
| `isAuthenticated` derived from current user | `services/auth.service.ts:25` |
| Permissions computed from user's roles via local map | `services/auth.service.ts:26-29`, `permissions/permissions.config.ts:17-26` |
| Login request + on-success store + navigate to `/` | `services/auth.service.ts:35-51` |
| Logout clears user and navigates to `/login` on success or error | `services/auth.service.ts:53-65` |
| Session revival: `GET /auth/check`, returns `of(null)` on HTTP error | `services/auth.service.ts:67-80` |
| `hasPermission` helper over computed permissions | `services/auth.service.ts:82-84` |
| `/login` page layout: centered card, 440px max, slide-up-fade-in | `pages/login.page.ts:27-62` |
| `/login` page renders server error above form | `pages/login.page.ts:19-21` |
| `/login` page wires form submit to auth service | `pages/login.page.ts:69-71` |
| Login form controls: required + min-length 3 on username, required on password | `components/login-form/login-form.component.ts:28-31` |
| Login form markup + inline field errors | `components/login-form/login-form.component.html:3-19` |
| Login form submit button (disabled while invalid) | `components/login-form/login-form.component.html:21-23` |
| Login form emits `{ username, password }` credentials | `components/login-form/login-form.component.ts:26,35`, `types.ts:10-13` |
| Route gate: admits when signed in, else calls revival + redirect | `guards/auth.guard.ts:7-24` |
| Route gate applied to protected parent | `src/app/app.routes.ts:17` |
| Permission route gate — defined, not wired to any route | `guards/permission.guard.ts:7-18` |
| Admin routes (no permission gate today) | `src/app/app.routes.ts:26-39` |
| `*appRequirePermission` directive — renders/clears on signal change | `directives/require-permission.directive.ts:15-27` |
| Directive exported from module barrel | `keycloak-auth.module.ts:7-8`, `index.ts:5` |
| `Permission` + `Role` unions (FE-side, diverges from backend) | `permissions/permissions.types.ts:1-10` |
| `ROLE_PERMISSIONS` map (admin / user / viewer) | `permissions/permissions.config.ts:3-15` |
| `getPermissionsForRoles` + pure `hasPermission` helper | `permissions/permissions.config.ts:17-30` |
| `User`, `LoginCredentials`, `AuthState` shapes | `src/app/features/keycloak-auth/types.ts` |
| Cross-cutting: `withCredentials` + 401 refresh + retry, excludes `/auth/*` | `src/app/features/api-client/interceptors/auth.interceptor.ts:12-25` |
| Cross-cutting: activity recording on every request | `src/app/features/api-client/interceptors/activity.interceptor.ts` |
| Cross-cutting: proactive-refresh + inactivity timers (dormant) | `src/app/features/api-client/services/session-management.service.ts:8-36` |
| App config — interceptors registered, no initializer runs `checkAuth()` | `src/app/app.config.ts:11-22` |

### Backend contract

Shapes and routes served by the backend `keycloak-auth` feature; see `projects/application/backend/app/src/features/keycloak-auth/.docs/spec.md` and `contracts.md`.
