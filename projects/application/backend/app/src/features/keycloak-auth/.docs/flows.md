# Keycloak Auth — Flows

All flows run after `cookie-parser` and CORS middleware (`src/main.ts:9,13`). The global `KeycloakJwtGuard` is registered via `APP_GUARD` (`src/app.module.ts:23-28`) so it runs on every handler unless `@Public()` metadata is present.

## Flow 1: Login (happy path)

1. Client `POST /auth/login` with body `{ username, password }`.
2. `KeycloakJwtGuard.canActivate()` checks metadata key `"isPublic"` via `Reflector.getAllAndOverride` and short-circuits to `true` because `@Public()` is set on the handler (`controllers/keycloak-auth.controller.ts:33`, `guards/keycloak-jwt.guard.ts:22-27`).
3. `KeycloakAuthController.login()` calls `KeycloakAuthService.login(loginDto)` (`controllers/keycloak-auth.controller.ts:40`).
4. Service builds URL-encoded form: `client_id`, `client_secret`, `grant_type=password`, `username`, `password` (`services/keycloak-auth.service.ts:24-29`).
5. Service `POST`s to `${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token` (`services/keycloak-auth.service.ts:32-41`).
6. Keycloak responds 200 with `{ access_token, refresh_token, expires_in, ... }`. Service returns `{ accessToken, refreshToken, expiresIn }` (`services/keycloak-auth.service.ts:49-55`).
7. Controller sets `access_token` cookie with `maxAge = expiresIn * 1000` and the shared cookie options (`controllers/keycloak-auth.controller.ts:43-47`).
8. Controller sets `refresh_token` cookie with `maxAge = 30 days` (`:48-51`).
9. Controller calls `authService.validateToken(tokens.accessToken)` which `jose.decodeJwt`s the token, checks `exp`, and maps claims to a `KeycloakUserProfile` (`services/keycloak-auth.service.ts:124-143,155-169`).
10. Controller responds 200 with `{ message: "Login successful", user: { id, username, email, roles, firstName, lastName } }` (`:55-65`).

## Flow 2: Login (invalid credentials)

1. Client `POST /auth/login` with wrong password.
2. `@Public()` skips JWT guard.
3. Service `POST`s to Keycloak token endpoint; Keycloak returns non-2xx (`services/keycloak-auth.service.ts:43`).
4. Service logs the body and throws `UnauthorizedException('Invalid credentials')` (`:44-47`).
5. Any other thrown error is caught by the outer `try` and surfaces as `UnauthorizedException('Authentication failed')` (`:56-59`).
6. Controller `catch` logs the error and rethrows `UnauthorizedException('Invalid credentials')` (`:66-69`).
7. Client receives `401 { statusCode: 401, message: "Invalid credentials", error: "Unauthorized" }` (default Nest exception filter). No cookies are set.

## Flow 3: Token refresh (happy path)

1. Client `POST /auth/refresh`. Browser attaches `access_token` and `refresh_token` cookies.
2. Route is **not** `@Public()`, so `KeycloakJwtGuard` runs and must succeed on the current `access_token` (`guards/keycloak-jwt.guard.ts:29-42`). If the access token is already expired, the request fails with 401 here and the flow ends (client should log out or re-login).
3. Guard attaches `request.user`; controller proceeds.
4. Controller reads `refresh_token` from `request.cookies` (`controllers/keycloak-auth.controller.ts:95`).
5. Controller calls `KeycloakAuthService.refreshToken(refreshToken)` (`:102`).
6. Service builds URL-encoded form with `grant_type=refresh_token` and the refresh token (`services/keycloak-auth.service.ts:62-67`) and POSTs to the same token endpoint.
7. On 2xx, service returns `{ accessToken, refreshToken, expiresIn }` (`:85-91`).
8. Controller sets both cookies with fresh values (access `maxAge = expiresIn*1000`, refresh `30 days`) and responds 200 `{ message: "Token refreshed successfully" }` (`:104-114`).

## Flow 4: Token refresh (missing or invalid refresh token)

1. If `request.cookies.refresh_token` is absent: controller throws `UnauthorizedException('Refresh token not found')` before calling the service (`controllers/keycloak-auth.controller.ts:97-99`). Client receives 401; cookies untouched.
2. If present but Keycloak rejects it: service throws `UnauthorizedException('Invalid refresh token')` from the `!response.ok` branch (`services/keycloak-auth.service.ts:81-83`) or the outer `catch` rethrows `UnauthorizedException('Failed to refresh token')` (`:92-95`).
3. Controller `catch` logs, clears **both** cookies, and rethrows `UnauthorizedException('Failed to refresh token')` (`controllers/keycloak-auth.controller.ts:115-123`).

## Flow 5: Logout

1. Client `POST /auth/logout`.
2. Route is not `@Public()`: `KeycloakJwtGuard` runs and requires a valid `access_token` cookie or bearer header. If absent/expired the request 401s and cookies are NOT cleared by this handler.
3. On a successful guard pass, controller reads `request.cookies.refresh_token` (`controllers/keycloak-auth.controller.ts:77`).
4. If present, controller calls `KeycloakAuthService.logout(refreshToken)`, which POSTs to `${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/logout` with client credentials and the refresh token (`services/keycloak-auth.service.ts:98-114`).
5. If the Keycloak logout call fails, the service only logs a warning — it does NOT throw (`:116-121`). This keeps the local logout idempotent.
6. Controller clears `access_token` and `refresh_token` cookies regardless of the Keycloak response (`controllers/keycloak-auth.controller.ts:84-85`) and responds 200 `{ message: "Logout successful" }`.

## Flow 6: Auth check (protected request with user accessor)

1. Client `GET /auth/check` with `access_token` cookie.
2. `KeycloakJwtGuard.canActivate()`: `@Public()` not set, so continue (`guards/keycloak-jwt.guard.ts:22-27`).
3. `extractTokenFromRequest()` returns the cookie value (cookies take precedence over `Authorization` header, `:45-57`).
4. Guard calls `KeycloakAuthService.validateToken(token)`; service `jose.decodeJwt`s it and throws if `exp * 1000 < Date.now()` (`services/keycloak-auth.service.ts:155-168`). Note signature is NOT verified.
5. Service builds `KeycloakUserProfile` by unioning `payload.realm_access.roles` with `payload.resource_access[clientId].roles` (`:128-138,145-153`).
6. Guard assigns `request.user = profile` and returns `true` (`guards/keycloak-jwt.guard.ts:36-38`).
7. Handler receives the profile via `@KeycloakUser()` (`decorators/keycloak-user.decorator.ts:4-10`, `controllers/keycloak-auth.controller.ts:128`).
8. Handler calls `getPermissionsForRoles(user.roles)` to produce a deduplicated list of permission strings (`permissions/permissions.constants.ts:62-73`).
9. Handler responds 200 with `{ authenticated: true, user, permissions }` (`controllers/keycloak-auth.controller.ts:133-144`).

## Flow 7: Any non-public route (global guard path)

1. Request arrives for e.g. `GET /theme` or `GET /users`.
2. `KeycloakJwtGuard` runs (global). No token in cookie or bearer header -> `401 "No token provided"` (`guards/keycloak-jwt.guard.ts:31-33`).
3. Token present but expired or malformed -> `validateToken` throws, guard rethrows `401 "Invalid token"` (`:39-42`).
4. Token valid -> `request.user` is set. Control passes to next guards/interceptors/handler.
5. If the handler is decorated with `@RequirePermission('users:read')` (e.g. `features/user-management/controllers/user-management.controller.ts:34`), nothing enforces it in the current wiring: `PermissionGuard` is not registered as `APP_GUARD` and no controller applies `@UseGuards(PermissionGuard)`. The metadata is silently ignored at runtime.

## Flow 8: Hypothetical permission check (when `PermissionGuard` is attached)

This is the intended flow per `guards/permission.guard.ts` and the module's README; it is only reachable once a caller opts in with `@UseGuards(KeycloakJwtGuard, PermissionGuard)` or the guard is registered via `APP_GUARD`.

1. After `KeycloakJwtGuard` attaches `request.user`, `PermissionGuard.canActivate()` runs (`guards/permission.guard.ts:35`).
2. `@Public()` short-circuits to true (`:37-44`).
3. Reflector reads `PermissionMetadata` under key `"requirePermission"` from handler then class (`:46-51`).
4. No metadata -> allow (`:53-56`).
5. No `request.user` -> log warn, throw `ForbiddenException('User not authenticated')` (`:59-67`).
6. Resolve `userPermissions = getPermissionsForRoles(user.roles)` (`:70-71`).
7. If `options.requireAll` is true, call `hasAllPermissions`; otherwise `hasAnyPermission` (`:94-103`).
8. On fail -> log warn, throw `ForbiddenException('Insufficient permissions')` (`:81-86`). On success -> return true.
