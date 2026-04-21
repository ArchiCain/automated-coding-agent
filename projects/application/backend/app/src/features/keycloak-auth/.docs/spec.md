# Keycloak Auth — Spec

## What it is

The backend's front door for authentication. It lets a user log in with a username and password, keeps them signed in via secure cookies, lets them refresh that session, and logs them out. Every other backend route is protected by default — callers must be signed in unless a route explicitly opts out. The browser never talks to Keycloak directly; it only talks to this feature, which in turn talks to the Keycloak `application` realm.

## How it behaves

### Logging in

The user posts a username and password to `/auth/login`. The backend exchanges them with Keycloak for a pair of tokens and stores them as HTTP-only cookies on the response — one short-lived access token and one longer-lived refresh token. The response body returns the user's profile (id, username, email, first name, last name, and realm/client roles) but never the raw tokens. Wrong credentials come back as `401 "Invalid credentials"` with no cookies set.

### Staying signed in

Every subsequent request must carry the access token. The backend accepts it from the `access_token` cookie first, falling back to an `Authorization: Bearer …` header. Missing token answers `401 "No token provided"`; an expired token answers `401 "Invalid token"`. On success, the request is tagged with the signed-in user's profile so downstream handlers can see who is calling.

### Refreshing a session

When the access token is about to expire, the client calls `/auth/refresh`. The caller must still be signed in for this call to reach the handler. The backend reads the refresh-token cookie, asks Keycloak for a new pair, and resets both cookies. If there is no refresh cookie the response is `401 "Refresh token not found"`. If Keycloak rejects the refresh, both cookies are cleared and the response is `401 "Failed to refresh token"`.

### Logging out

The client calls `/auth/logout`. The caller must be signed in. If a refresh token is present the backend asks Keycloak to revoke it, but either way both cookies are cleared on the response and the endpoint answers `200 "Logout successful"` — a failure at Keycloak does not prevent the user's local session from ending.

### Checking who is signed in

`GET /auth/check` returns `{ authenticated: true, user, permissions }` for the current caller. `permissions` is the flat list of permission strings derived from the user's roles (for example, an `admin` user gets all seven permissions; a `user` gets the two conversation permissions), not the raw role names.

### Opting routes out of auth

A route or controller can be marked public to skip the auth check entirely. Public routes are reachable without any cookie or header.

## Acceptance criteria

- Logging in with valid realm credentials returns 200, sets `access_token` and `refresh_token` as HTTP-only cookies, and returns the user's profile in the body without raw tokens.
- Logging in with wrong credentials returns `401 "Invalid credentials"` and sets no cookies.
- Cookies are always `httpOnly` and scoped to `/`. In production they are `secure` and `sameSite=strict`; outside production they are not `secure` and use `sameSite=lax`.
- The access-token cookie's lifetime matches Keycloak's returned `expires_in`; the refresh-token cookie lives for 30 days.
- Refreshing with a valid refresh cookie returns 200 and replaces both cookies.
- Refreshing with no refresh cookie returns `401 "Refresh token not found"`.
- Refreshing with an invalid or expired refresh cookie returns `401 "Failed to refresh token"` and clears both cookies.
- Logging out clears both cookies and returns 200 even if the Keycloak revocation call fails.
- `GET /auth/check` returns `{ authenticated: true, user, permissions }`, where `permissions` is the list derived from the user's roles rather than the role names themselves.
- Protected routes accept the token from the `access_token` cookie first, then from an `Authorization: Bearer …` header.
- Protected routes return 401 when no token is present and 401 when the token is past its expiration time.
- Routes marked public are reachable with no cookie and no header.
- `admin` resolves to all seven permissions; `user` resolves to `conversations:read` and `conversations:create`; unknown roles contribute no permissions.

## Known gaps

- Access tokens are decoded, not verified. The backend only reads the JWT's claims and checks the `exp` timestamp against the current time — it never verifies the signature against Keycloak's JWKS. A forged or tampered token with a valid `exp` would currently pass the auth check. Flagged in-code (`services/keycloak-auth.service.ts:157-162`).
- The permission-checking machinery is wired up but not hooked in. The `@RequirePermission` decorator and its guard are implemented and exported, and the admin-only user-management routes are decorated with permissions like `users:read` and `users:delete` — but the guard is never registered globally and no controller applies it. Today those routes are gated only by "are you signed in," so any authenticated user satisfies them (`src/app.module.ts:23-28`; `features/user-management/controllers/user-management.controller.ts:34,44,54,64,77,88`).

## Code map

Paths are relative to `projects/application/backend/app/`.

| Concern | File · lines |
|---|---|
| Controller mounted at `/auth` | `src/features/keycloak-auth/controllers/keycloak-auth.controller.ts:18` |
| `POST /auth/login` handler (marked `@Public()`) | `src/features/keycloak-auth/controllers/keycloak-auth.controller.ts:33,40-69` |
| `POST /auth/logout` handler (requires auth) | `src/features/keycloak-auth/controllers/keycloak-auth.controller.ts:83-87` |
| `POST /auth/refresh` handler (requires auth) | `src/features/keycloak-auth/controllers/keycloak-auth.controller.ts:97-123` |
| `GET /auth/check` handler | `src/features/keycloak-auth/controllers/keycloak-auth.controller.ts:131` |
| Cookie options (httpOnly, secure-in-prod, sameSite, path) | `src/features/keycloak-auth/controllers/keycloak-auth.controller.ts:21-29,43-51,104-112` |
| `access_token` lifetime = Keycloak `expires_in`; `refresh_token` = 30 days | `src/features/keycloak-auth/controllers/keycloak-auth.controller.ts:43-51,104-112` |
| Keycloak password-grant call (`backend-service` confidential client) | `src/features/keycloak-auth/services/keycloak-auth.service.ts:15-18,24-41` |
| Keycloak refresh-grant call | `src/features/keycloak-auth/services/keycloak-auth.service.ts:62-96` |
| Keycloak logout/revoke call | `src/features/keycloak-auth/services/keycloak-auth.service.ts:98-122` |
| `validateToken()` — decode-only, `exp` check, no signature verification | `src/features/keycloak-auth/services/keycloak-auth.service.ts:157-162` |
| User profile derivation from claims (`sub`, `preferred_username`, realm + client roles) | `src/features/keycloak-auth/services/keycloak-auth.service.ts:128-138,145-153` |
| Global JWT guard `KeycloakJwtGuard` (runs on every route) | `src/features/keycloak-auth/guards/keycloak-jwt.guard.ts:13` |
| Global JWT guard wired via `APP_GUARD` | `src/app.module.ts:23-28` |
| Token extraction: cookie first, then `Authorization: Bearer …` | `src/features/keycloak-auth/guards/keycloak-jwt.guard.ts:45-58` |
| Guard error responses: `"No token provided"`, `"Invalid token"` | `src/features/keycloak-auth/guards/keycloak-jwt.guard.ts:32,40-41` |
| Guard attaches `KeycloakUserProfile` to `request.user` | `src/features/keycloak-auth/guards/keycloak-jwt.guard.ts:37` |
| `PermissionGuard` implementation (any/all semantics) | `src/features/keycloak-auth/guards/permission.guard.ts:30,46-89` |
| `PermissionGuard` provided/exported but not globally registered and not applied anywhere | `src/features/keycloak-auth/keycloak-auth.module.ts:10-11`; `src/app.module.ts:23-28` |
| `@RequirePermission` decorated but unenforced on user-management routes | `src/features/user-management/controllers/user-management.controller.ts:34,44,54,64,77,88` |
| `@Public()` decorator (sets `"isPublic"` metadata) | `src/features/keycloak-auth/decorators/public.decorator.ts:5` |
| `@Public()` honored by JWT guard and permission guard | `src/features/keycloak-auth/guards/keycloak-jwt.guard.ts:22-27`; `src/features/keycloak-auth/guards/permission.guard.ts:37-44` |
| `@KeycloakUser(field?)` param decorator | `src/features/keycloak-auth/decorators/keycloak-user.decorator.ts` |
| `@RequirePermission(permissions, { requireAll? })` | `src/features/keycloak-auth/decorators/require-permission.decorator.ts:34-50` |
| Permission strings and role mapping (`admin`, `user`) | `src/features/keycloak-auth/permissions/permissions.constants.ts` |
| `getPermissionsForRoles()` (used by `/auth/check`) | `src/features/keycloak-auth/permissions/permissions.constants.ts:62` |
| Types (`KeycloakUserProfile`, `JwtTokens`, `LoginDto`, `TokenPayload`) | `src/features/keycloak-auth/keycloak-types.ts` |
