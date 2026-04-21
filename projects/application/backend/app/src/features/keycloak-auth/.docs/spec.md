# Auth — Requirements

## What It Does

Handles authentication by proxying credentials to Keycloak and managing JWT tokens via HTTP-only cookies. The frontend never talks to Keycloak directly.

## Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/auth/login` | Public | Exchange username/password for tokens |
| POST | `/auth/logout` | Public | Revoke refresh token, clear cookies |
| POST | `/auth/refresh` | Cookie | Refresh expired access token |
| GET | `/auth/check` | JWT | Validate session, return user profile + permissions |

## Login Flow

1. Frontend sends `{ username, password }` to `POST /auth/login`
2. Service calls Keycloak token endpoint with client credentials + user credentials
3. Keycloak returns `access_token` + `refresh_token`
4. Service sets both as HTTP-only cookies and returns user profile

## Token Refresh Flow

1. Access token expires (5 min TTL)
2. Frontend receives 401, calls `POST /auth/refresh`
3. Service reads `refresh_token` from cookie, exchanges with Keycloak
4. New `access_token` cookie set, original request retried

## Auth Check Response

```typescript
{
  authenticated: true,
  user: {
    id: string,
    username: string,
    email: string,
    firstName?: string,
    lastName?: string,
    roles: string[]
  },
  permissions: string[]  // Resolved from role-permission mapping
}
```

## Guards & Decorators

| Name | Purpose |
|------|---------|
| `KeycloakJwtGuard` | Global guard — validates JWT from cookie or Authorization header |
| `PermissionGuard` | Route-level — checks `@RequirePermission()` against user permissions |
| `@Public()` | Skip JWT validation for this route |
| `@KeycloakUser()` | Inject user profile or specific property into handler |
| `@RequirePermission()` | Require specific permission string |

## Acceptance Criteria

- [ ] Login sets HTTP-only cookies (not accessible via JavaScript)
- [ ] 401 responses include no token data in the body
- [ ] Refresh works with valid refresh token cookie
- [ ] Auth check returns resolved permissions, not raw roles
- [ ] Invalid/expired tokens return 401
- [ ] Logout revokes refresh token on Keycloak server
