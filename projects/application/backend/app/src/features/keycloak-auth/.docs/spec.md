# Keycloak Auth — Spec

## Purpose

Backend-side consumer of the Keycloak `application` realm. Proxies login/logout/refresh through Keycloak's OIDC token + logout endpoints using the confidential `backend-service` client (`services/keycloak-auth.service.ts:15-18`), stores JWTs in HTTP-only cookies (`controllers/keycloak-auth.controller.ts:21-29`), and provides the primitives other features use for authz: a globally-registered `KeycloakJwtGuard` (`src/app.module.ts:23-28`), a `@Public()` opt-out, a `@KeycloakUser()` param decorator, a role-to-permission map, plus a `PermissionGuard` + `@RequirePermission()` pair. The frontend never contacts Keycloak directly.

## Behavior

### Endpoints (`controllers/keycloak-auth.controller.ts`)
- `POST /auth/login` is marked `@Public()` (`:33`). Accepts `{ username, password }`, calls Keycloak's token endpoint via password grant (`services/keycloak-auth.service.ts:24-41`). On success sets `access_token` and `refresh_token` cookies and returns `{ message, user: { id, username, email, roles, firstName, lastName } }` (`controllers/keycloak-auth.controller.ts:40-65`). On failure responds `401 Unauthorized` with message `"Invalid credentials"` (`:66-69`).
- `POST /auth/logout` is **NOT** `@Public()`, so the global JWT guard runs first and a valid `access_token` is required. If a `refresh_token` cookie is present it is revoked via Keycloak's `.../openid-connect/logout` endpoint (`services/keycloak-auth.service.ts:98-122`). Cookies are cleared regardless of the Keycloak call result (`controllers/keycloak-auth.controller.ts:83-87`). Returns `200 { message: "Logout successful" }`.
- `POST /auth/refresh` is **NOT** `@Public()`. A valid access token must already be in the cookie for the global guard to pass. The controller then reads `refresh_token` from the cookie and calls Keycloak's token endpoint with `grant_type=refresh_token` (`services/keycloak-auth.service.ts:62-96`). On success resets both cookies and returns `{ message: "Token refreshed successfully" }`. On failure clears both cookies and returns `401 "Failed to refresh token"` (`controllers/keycloak-auth.controller.ts:115-123`). If no `refresh_token` cookie is present responds `401 "Refresh token not found"` (`:97-99`).
- `GET /auth/check` returns `{ authenticated: true, user: { id, username, email, roles, firstName, lastName }, permissions: string[] }`. Permissions are resolved from the user's roles via `getPermissionsForRoles()` (`controllers/keycloak-auth.controller.ts:131`, `permissions/permissions.constants.ts:62`).

### Cookies (`controllers/keycloak-auth.controller.ts:21-29,43-51,104-112`)
- Options: `httpOnly: true`, `secure: NODE_ENV === "production"`, `sameSite: "strict"` in production otherwise `"lax"`, `path: "/"`.
- `access_token` maxAge = `tokens.expiresIn * 1000` ms (Keycloak default access lifespan is 300 s per `projects/application/keycloak/.docs/spec.md:15`).
- `refresh_token` maxAge = 30 days (`30 * 24 * 60 * 60 * 1000`).

### JWT handling (`services/keycloak-auth.service.ts`)
- `validateToken()` calls `decodeToken()` which uses `jose.decodeJwt(token)` (`:158`). An in-code comment flags the behavior: **"Simple validation - in production, you should verify signature with JWKS"** (`:157`). Signature is NOT verified against Keycloak's JWKS; only the `exp` claim is checked against `Date.now()` (`:160-162`).
- User profile derived from claims: `id = sub`, `username = preferred_username`, `email`, `firstName = given_name`, `lastName = family_name`, `roles = realm_access.roles ∪ resource_access[clientId].roles` (`:128-138,145-153`).

### Global JWT guard (`guards/keycloak-jwt.guard.ts`, wired in `src/app.module.ts:23-28`)
- Registered via `APP_GUARD` so it runs on every route unless `@Public()` metadata is set on the handler or class (`:22-27`).
- Extracts token first from `request.cookies.access_token`, then from `Authorization: Bearer <token>` header (`:45-58`).
- No token -> `401 "No token provided"` (`:32`). Token but `validateToken()` throws -> `401 "Invalid token"` (`:40-41`).
- On success attaches the `KeycloakUserProfile` to `request.user` (`:37`), readable via `@KeycloakUser()`.

### `PermissionGuard` + `@RequirePermission` — metadata-only reality
- `PermissionGuard` (`guards/permission.guard.ts`) and `@RequirePermission` (`decorators/require-permission.decorator.ts`) are implemented and exported. Guard logic: read `@RequirePermission` metadata, read `request.user`, resolve permissions from roles, and enforce "any" (default) or "all" semantics (`guards/permission.guard.ts:46-89`).
- `KeycloakAuthModule` provides and exports `PermissionGuard` (`keycloak-auth.module.ts:10-11`) but does NOT register it via `APP_GUARD`, and no controller currently applies it via `@UseGuards(..., PermissionGuard)` (`src/app.module.ts:23-28`; verified by grep across `src/`).
- `UserManagementController` stacks `@RequirePermission('users:read' | 'users:create' | 'users:update' | 'users:delete')` on every route (`features/user-management/controllers/user-management.controller.ts:34,44,54,64,77,88`) but has no `@UseGuards(PermissionGuard)`, so today the metadata is read by no active guard. Those routes are effectively admin-gated only by the JWT guard — any authenticated user satisfies them.

### Decorators
- `@Public()` (`decorators/public.decorator.ts:5`) sets metadata key `"isPublic"=true`. Checked by both `KeycloakJwtGuard` (`:22-27`) and `PermissionGuard` (`:37-44`).
- `@KeycloakUser(field?)` (`decorators/keycloak-user.decorator.ts`) returns `request.user` or a specific field when called as `@KeycloakUser('id')`.
- `@RequirePermission(permissions, { requireAll? })` (`decorators/require-permission.decorator.ts:34-50`) normalizes to an array and stores `PermissionMetadata` under key `"requirePermission"`.

### Roles and permissions (`permissions/permissions.constants.ts`, `permissions/permissions.types.ts`)
- Permission strings: `users:read|create|update|delete`, `conversations:read|create|delete`.
- Roles: `admin` -> all seven permissions; `user` -> `conversations:read`, `conversations:create`.
- `getPermissionsForRoles(roles)` unions+dedupes via `Set`; unrecognized roles contribute nothing.

## Endpoints / Services / Guards

| Kind | Name | Source |
|---|---|---|
| Controller | `KeycloakAuthController` @ `/auth` | `controllers/keycloak-auth.controller.ts:18` |
| Service | `KeycloakAuthService` | `services/keycloak-auth.service.ts:7` |
| Guard (global) | `KeycloakJwtGuard` | `guards/keycloak-jwt.guard.ts:13`, wired `src/app.module.ts:23-28` |
| Guard (unattached) | `PermissionGuard` | `guards/permission.guard.ts:30` |
| Decorator | `@Public`, `@KeycloakUser`, `@RequirePermission` | `decorators/*.ts` |
| Types | `KeycloakUserProfile`, `JwtTokens`, `LoginDto`, `TokenPayload` | `keycloak-types.ts` |
| Perms | `PERMISSIONS`, `ROLE_PERMISSIONS`, `getPermissionsForRoles`, `hasAllPermissions`, `hasAnyPermission` | `permissions/permissions.constants.ts` |

## Acceptance Criteria

- [ ] `POST /auth/login` with valid realm user returns 200, sets HTTP-only `access_token` + `refresh_token` cookies, and body contains the user profile without raw tokens.
- [ ] `POST /auth/login` with wrong credentials returns 401 `"Invalid credentials"` and sets no cookies.
- [ ] Cookie attributes: `httpOnly=true`; in production `secure=true`, `sameSite=strict`; in non-production `secure=false`, `sameSite=lax`.
- [ ] `access_token` cookie maxAge equals the Keycloak `expires_in` in milliseconds; `refresh_token` maxAge is 30 days.
- [ ] `POST /auth/refresh` with a valid refresh cookie returns 200 and sets new `access_token` + `refresh_token` cookies.
- [ ] `POST /auth/refresh` with no refresh cookie returns 401 `"Refresh token not found"`.
- [ ] `POST /auth/refresh` with invalid/expired refresh cookie returns 401 `"Failed to refresh token"` AND clears both cookies.
- [ ] `POST /auth/logout` clears both cookies and returns 200 even when the Keycloak logout call fails.
- [ ] `GET /auth/check` returns `{ authenticated: true, user, permissions }` where `permissions` is resolved from roles, not the raw role list.
- [ ] `KeycloakJwtGuard` accepts `access_token` cookie OR `Authorization: Bearer <token>` header, prioritizing the cookie.
- [ ] `KeycloakJwtGuard` short-circuits and returns true on routes/classes marked `@Public()`.
- [ ] `KeycloakJwtGuard` returns 401 when no token present and 401 when token is expired (`exp * 1000 < Date.now()`).
- [ ] Token signature is NOT verified against JWKS — `jose.decodeJwt` is used (documented behavior, not a bug for this spec).
- [ ] `getPermissionsForRoles(['admin'])` returns all seven permissions; `['user']` returns `['conversations:read','conversations:create']`; unknown roles contribute no permissions.
- [ ] `PermissionGuard` and `@RequirePermission` exist and are exported, but `PermissionGuard` is NOT globally registered and NOT applied via `@UseGuards` on any current controller. Therefore `@RequirePermission` metadata is currently non-enforcing.
