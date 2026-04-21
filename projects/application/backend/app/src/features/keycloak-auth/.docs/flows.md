# Keycloak Auth — Flows

## Flow 1: Login (Happy Path)

1. Client sends `POST /auth/login` with `{ username, password }`
2. `@Public()` decorator skips JWT guard for this route
3. Controller calls `KeycloakAuthService.login(loginDto)`
4. Service builds form-urlencoded body with `client_id`, `client_secret`, `grant_type=password`, `username`, `password`
5. Service POSTs to Keycloak token endpoint: `{baseUrl}/realms/{realm}/protocol/openid-connect/token`
6. Keycloak validates credentials and returns `{ access_token, refresh_token, expires_in }`
7. Service maps response to `JwtTokens` object
8. Controller sets `access_token` as HTTP-only cookie (maxAge = expiresIn * 1000)
9. Controller sets `refresh_token` as HTTP-only cookie (maxAge = 30 days)
10. Controller calls `authService.validateToken(accessToken)` to decode user profile
11. Controller returns `{ message: "Login successful", user: { id, username, email, roles, firstName, lastName } }`

## Flow 2: Login (Invalid Credentials)

1. Client sends `POST /auth/login` with wrong password
2. Service POSTs to Keycloak token endpoint
3. Keycloak returns non-200 response
4. Service throws `UnauthorizedException('Invalid credentials')`
5. Controller catches the error, logs it, rethrows `UnauthorizedException('Invalid credentials')`
6. Client receives 401 `{ statusCode: 401, message: "Invalid credentials" }`

## Flow 3: Token Refresh (Happy Path)

1. Client sends `POST /auth/refresh` (browser includes refresh_token cookie)
2. Controller extracts `refresh_token` from `request.cookies`
3. Controller calls `KeycloakAuthService.refreshToken(refreshToken)`
4. Service builds form-urlencoded body with `grant_type=refresh_token` and the refresh token
5. Service POSTs to Keycloak token endpoint
6. Keycloak returns new `access_token` and `refresh_token`
7. Controller sets new `access_token` cookie and new `refresh_token` cookie
8. Controller returns `{ message: "Token refreshed successfully" }`

## Flow 4: Token Refresh (Expired Refresh Token)

1. Client sends `POST /auth/refresh` with expired refresh token
2. Service POSTs to Keycloak token endpoint
3. Keycloak returns non-200
4. Service throws `UnauthorizedException('Failed to refresh token')`
5. Controller catches error, clears both cookies, rethrows 401
6. Client receives 401, must re-authenticate

## Flow 5: Logout

1. Client sends `POST /auth/logout`
2. Controller extracts `refresh_token` from cookies
3. If refresh_token exists, calls `KeycloakAuthService.logout(refreshToken)`
4. Service POSTs to Keycloak logout endpoint: `{baseUrl}/realms/{realm}/protocol/openid-connect/logout`
5. Controller clears `access_token` and `refresh_token` cookies regardless of Keycloak response
6. Returns `{ message: "Logout successful" }`

## Flow 6: Auth Check

1. Client sends `GET /auth/check` (browser includes access_token cookie)
2. `KeycloakJwtGuard` fires (route is not `@Public()`)
3. Guard extracts token from cookie (priority) or Authorization header
4. Guard calls `KeycloakAuthService.validateToken(token)`
5. Service decodes JWT using `jose.decodeJwt()`, checks expiry
6. Service extracts user profile: `{ id: sub, username: preferred_username, email, firstName, lastName, roles }` (combines realm_access.roles + resource_access client roles)
7. Guard attaches user to `request['user']`
8. Controller reads user from `@KeycloakUser()` decorator
9. Controller calls `getPermissionsForRoles(user.roles)` to resolve permissions from role-permission mapping
10. Returns `{ authenticated: true, user: { id, username, email, roles, firstName, lastName }, permissions: [...] }`

## Flow 7: Protected Route (Permission Check)

1. Client sends request to a `@RequirePermission('users:read')` endpoint
2. `KeycloakJwtGuard` validates token and attaches user to request
3. `PermissionGuard` fires next
4. Guard reads `@RequirePermission()` metadata from route handler
5. Guard reads user from `request['user']`
6. Guard calls `getPermissionsForRoles(user.roles)` to get user's permissions
7. Guard checks if user permissions satisfy required permissions (any vs all based on `requireAll` option)
8. If satisfied: request proceeds to handler
9. If not: throws `ForbiddenException('Insufficient permissions')`
