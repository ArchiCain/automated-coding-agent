# Keycloak Auth — Test Plan

Tests map back to acceptance criteria in `spec.md` and flows in `flows.md`. Contract tests hit the HTTP boundary; behavior tests exercise the guard/service directly. Realm seed data (users, client secret) comes from `projects/application/keycloak/.docs/spec.md` — see `test-data.md`.

## Contract Tests (HTTP)

### `POST /auth/login`
- [ ] Returns 200 with `{ message: "Login successful", user: { id, username, email, roles, firstName?, lastName? } }` on valid credentials.
- [ ] Sets `access_token` cookie: `HttpOnly`, `Path=/`, `Max-Age ≈ tokens.expires_in`; `Secure` and `SameSite=Strict` when `NODE_ENV=production`, else `Secure=false`, `SameSite=Lax`.
- [ ] Sets `refresh_token` cookie with the same attributes and `Max-Age = 2592000` (30 days).
- [ ] Response body does NOT include raw tokens.
- [ ] Returns 401 `{ statusCode: 401, message: "Invalid credentials", error: "Unauthorized" }` for wrong password, non-existent user, and Keycloak network failure. No cookies set on failure.

### `POST /auth/logout`
- [ ] With valid `access_token` cookie: returns 200 `{ message: "Logout successful" }`, clears both `access_token` and `refresh_token` cookies (Set-Cookie with `Expires` in the past).
- [ ] With valid `access_token` but no `refresh_token` cookie: returns 200, still clears `access_token`; does NOT call Keycloak logout endpoint.
- [ ] When Keycloak logout endpoint returns non-2xx: controller still returns 200 and still clears cookies (a warning is logged but not surfaced).
- [ ] With no `access_token` (or expired): returns 401 from the global JWT guard; cookies NOT cleared by this handler.

### `POST /auth/refresh`
- [ ] With valid `access_token` cookie AND valid `refresh_token` cookie: returns 200 `{ message: "Token refreshed successfully" }` and sets new `access_token` + `refresh_token` cookies.
- [ ] With valid `access_token` but missing `refresh_token` cookie: returns 401 `{ message: "Refresh token not found" }`; cookies not touched by handler (global guard had already passed).
- [ ] With valid `access_token` but an invalid/expired `refresh_token`: returns 401 `{ message: "Failed to refresh token" }` and clears BOTH cookies.
- [ ] With no `access_token` cookie: returns 401 from the global guard `{ message: "No token provided" }`.

### `GET /auth/check`
- [ ] Returns 200 `{ authenticated: true, user: {...}, permissions: [...] }` when called with a valid `access_token` cookie or `Authorization: Bearer <token>` header.
- [ ] `permissions` equals `getPermissionsForRoles(user.roles)` — resolved permissions, not raw roles. Admin user returns all 7; standard `user` returns `['conversations:read','conversations:create']`.
- [ ] Returns 401 `{ message: "No token provided" }` when no token is present.
- [ ] Returns 401 `{ message: "Invalid token" }` when token is malformed or `exp*1000 < Date.now()`.

## Behavior Tests (unit)

### `KeycloakJwtGuard` (`guards/keycloak-jwt.guard.ts`)
- [ ] Returns `true` immediately when `@Public()` metadata is present on handler or class (verify with Reflector mock).
- [ ] Prefers `request.cookies.access_token` over `Authorization: Bearer` header.
- [ ] Falls back to bearer header when no cookie is present.
- [ ] Throws `UnauthorizedException("No token provided")` when neither source yields a token.
- [ ] Throws `UnauthorizedException("Invalid token")` when `KeycloakAuthService.validateToken()` throws.
- [ ] On success, `request.user` is set to the validated `KeycloakUserProfile`.

### `KeycloakAuthService` (`services/keycloak-auth.service.ts`)
- [ ] `login()` POSTs to `${KEYCLOAK_BASE_URL}/realms/${REALM}/protocol/openid-connect/token` with `grant_type=password` and the configured client credentials.
- [ ] `login()` maps `{ access_token, refresh_token, expires_in }` to `JwtTokens`.
- [ ] `login()` throws `UnauthorizedException("Invalid credentials")` on non-2xx Keycloak response.
- [ ] `refreshToken()` uses `grant_type=refresh_token`; non-2xx → `UnauthorizedException("Failed to refresh token")`.
- [ ] `logout()` POSTs to `.../openid-connect/logout`; a non-2xx response only logs a warning (does not throw).
- [ ] `validateToken()` returns a profile where `roles = realm_access.roles ∪ resource_access[clientId].roles`, handling missing `resource_access` / `realm_access` gracefully.
- [ ] `validateToken()` throws `UnauthorizedException("Invalid token")` when the token is expired. (Enforced by `jose.jwtVerify`, which checks `exp` internally.)
- [ ] `validateToken()` verifies the JWT signature against Keycloak's JWKS — tampering with the payload or signature causes `jose.jwtVerify` to throw and the service wraps it as `UnauthorizedException("Invalid token")`. Verified by `keycloak-auth.service.ts:162-171` using `jose.jwtVerify(token, this.jwks, { issuer: this.issuer })`.
- [ ] `validateToken()` rejects tokens whose `iss` claim does not match `${KEYCLOAK_BASE_URL}/realms/${REALM}` — `jose.jwtVerify` enforces the `issuer` option.

### `PermissionGuard` (`guards/permission.guard.ts`) — unit-testable in isolation even though not currently wired
- [ ] Returns `true` when `@Public()` metadata is set.
- [ ] Returns `true` when no `@RequirePermission()` metadata exists.
- [ ] Throws `ForbiddenException("User not authenticated")` when `request.user` is missing.
- [ ] With `{ requireAll: false }` (default), passes when user has ANY of the required permissions.
- [ ] With `{ requireAll: true }`, passes only when user has ALL required permissions; throws `ForbiddenException("Insufficient permissions")` otherwise.
- [ ] Admin role resolves to all 7 permissions via `getPermissionsForRoles`.

### Permissions helpers (`permissions/permissions.constants.ts`)
- [ ] `getPermissionsForRole('admin')` returns all 7; `'user'` returns 2; unknown role returns `[]`.
- [ ] `getPermissionsForRoles(['admin','user'])` returns a deduplicated union (7 items).
- [ ] `hasAllPermissions` and `hasAnyPermission` behave as documented on edge cases (empty required, empty user).

## E2E Scenarios

- [ ] Login → authenticated browser session: `POST /auth/login` as `testuser`/`password` from the seeded realm. A subsequent `GET /auth/check` from the same cookie jar returns 200 with `roles: ['user']` and `permissions: ['conversations:read','conversations:create']`.
- [ ] Login → logout → protected request: after `POST /auth/logout`, `GET /auth/check` returns 401.
- [ ] Login → refresh → check: after `POST /auth/refresh`, the new `access_token` cookie authorizes `GET /auth/check`.
- [ ] Invalid refresh cookie clears session: tamper with `refresh_token` cookie, `POST /auth/refresh` returns 401 and both cookies are cleared; subsequent `GET /auth/check` is 401.
- [ ] Admin login: `POST /auth/login` as `admin`/`admin` returns `roles` including `admin`, and `GET /auth/check` returns `permissions` containing all 7 strings.
- [ ] Bearer header path: `GET /auth/check` with no cookie but `Authorization: Bearer <token>` from a fresh login succeeds.
- [ ] **Known failing (tracks Known Gap: PermissionGuard).** `GET /users` decorated with `@RequirePermission('users:read')` is expected to return **403** for a standard `user`-role login and **200** for an `admin`-role login. Today it returns 200 for both because `PermissionGuard` isn't registered globally. See `spec.md` → Known gaps for the fix.
