# Keycloak Auth — Test Plan

## Login (`POST /auth/login`)

- [ ] Returns 200 with user profile on valid credentials
- [ ] Sets `access_token` HTTP-only cookie with correct maxAge
- [ ] Sets `refresh_token` HTTP-only cookie with 30-day maxAge
- [ ] Cookies have `secure: true` in production, `sameSite: strict` in production / `lax` in dev
- [ ] Returns 401 with "Invalid credentials" on wrong password
- [ ] Returns 401 with "Invalid credentials" on non-existent user
- [ ] Response body never contains raw tokens

## Logout (`POST /auth/logout`)

- [ ] Calls Keycloak logout endpoint to revoke refresh token
- [ ] Clears `access_token` cookie
- [ ] Clears `refresh_token` cookie
- [ ] Returns 200 even if Keycloak revocation fails (cookies still cleared)
- [ ] Works even if no refresh_token cookie is present

## Token Refresh (`POST /auth/refresh`)

- [ ] Returns 200 and sets new cookies with valid refresh token
- [ ] Returns 401 "Refresh token not found" when no cookie present
- [ ] Returns 401 "Failed to refresh token" when refresh token is expired/invalid
- [ ] Clears both cookies on failed refresh

## Auth Check (`GET /auth/check`)

- [ ] Returns authenticated user profile with resolved permissions
- [ ] Permissions are resolved from roles (not raw roles returned as permissions)
- [ ] Returns 401 when no valid token present
- [ ] Returns 401 when token is expired

## Guards

- [ ] `KeycloakJwtGuard` extracts token from cookie first, then Authorization header
- [ ] `KeycloakJwtGuard` skips validation for `@Public()` routes
- [ ] `KeycloakJwtGuard` returns 401 "No token provided" when no token found
- [ ] `PermissionGuard` returns 403 "Insufficient permissions" when user lacks required permission
- [ ] `PermissionGuard` passes when no `@RequirePermission()` metadata set
- [ ] `PermissionGuard` supports `requireAll` option for multiple permissions
