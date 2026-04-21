# Keycloak Auth — Contracts

All endpoints live under `/auth`, defined on `KeycloakAuthController` (`controllers/keycloak-auth.controller.ts:18`). Error bodies use NestJS's default exception filter shape: `{ statusCode, message, error }`.

## Endpoints

### `POST /auth/login`
**Auth:** Public (`@Public()` at `controllers/keycloak-auth.controller.ts:33`).

**Request body** (`keycloak-types.ts:16-19`):
```typescript
{
  username: string;
  password: string;
}
```

**Response 200** (`controllers/keycloak-auth.controller.ts:55-65`):
```typescript
{
  message: "Login successful";
  user: {
    id: string;          // Keycloak sub
    username: string;    // preferred_username
    email: string;       // "" if not in token
    roles: string[];     // realm roles + client roles for backend-service
    firstName?: string;  // given_name
    lastName?: string;   // family_name
  };
}
```

**Cookies set:**
- `access_token` — HTTP-only, `secure` in production, `sameSite=strict` in production else `lax`, `path=/`, `maxAge = tokens.expires_in * 1000` ms (`controllers/keycloak-auth.controller.ts:21-29,43-47`).
- `refresh_token` — same options, `maxAge = 30 * 24 * 60 * 60 * 1000` ms (30 days) (`:48-51`).

**Response 401** (`controllers/keycloak-auth.controller.ts:66-69`):
```typescript
{
  statusCode: 401;
  message: "Invalid credentials";
  error: "Unauthorized";
}
```

---

### `POST /auth/logout`
**Auth:** Required (JWT via global `KeycloakJwtGuard` — route is not `@Public()`).

**Request body:** empty.

**Response 200** (`controllers/keycloak-auth.controller.ts:87`):
```typescript
{ message: "Logout successful" }
```
Cookies cleared: `access_token`, `refresh_token` (always, even if Keycloak revocation fails — `:83-85`).

**Response 401** (from global guard): standard `{ statusCode: 401, message: "No token provided" | "Invalid token", error: "Unauthorized" }`.

---

### `POST /auth/refresh`
**Auth:** Required — the global JWT guard validates `access_token` before the handler runs. Handler additionally requires `refresh_token` cookie.

**Request body:** empty. Reads `request.cookies.refresh_token` (`controllers/keycloak-auth.controller.ts:95`).

**Response 200** (`:114`):
```typescript
{ message: "Token refreshed successfully" }
```
Cookies set: new `access_token` (maxAge from new `expires_in`) and new `refresh_token` (maxAge 30 days).

**Response 401 — no refresh cookie** (`:97-99`):
```typescript
{ statusCode: 401, message: "Refresh token not found", error: "Unauthorized" }
```

**Response 401 — Keycloak rejects the refresh** (`:115-123`):
```typescript
{ statusCode: 401, message: "Failed to refresh token", error: "Unauthorized" }
```
Both cookies are cleared on this path.

---

### `GET /auth/check`
**Auth:** Required (global JWT guard).

**Request body:** none. Handler reads the user via `@KeycloakUser()` (`controllers/keycloak-auth.controller.ts:128`).

**Response 200** (`:133-144`):
```typescript
{
  authenticated: true;
  user: {
    id: string;
    username: string;
    email: string;
    roles: string[];
    firstName?: string;
    lastName?: string;
  };
  permissions: Permission[]; // resolved via getPermissionsForRoles(user.roles)
}
```

**Response 401** (from global guard): `{ statusCode: 401, message: "No token provided" | "Invalid token", error: "Unauthorized" }`.

## Shared types (exported from `keycloak-auth/index.ts`)

From `keycloak-types.ts`:
```typescript
export interface KeycloakUserProfile {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
}

export interface JwtTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

export interface LoginDto {
  username: string;
  password: string;
}

// Minimal view of the Keycloak access-token claims the service reads.
export interface TokenPayload {
  exp: number; iat: number; auth_time: number; jti: string;
  iss: string; sub: string; typ: string; azp: string;
  session_state: string; acr: string;
  realm_access: { roles: string[] };
  resource_access: { [clientId: string]: { roles: string[] } };
  scope: string;
  email_verified: boolean;
  name?: string;
  preferred_username: string;
  given_name?: string;
  family_name?: string;
  email?: string;
}
```

From `permissions/permissions.types.ts`:
```typescript
export type Permission =
  | 'users:read' | 'users:create' | 'users:update' | 'users:delete'
  | 'conversations:read' | 'conversations:create' | 'conversations:delete';

export type Role = 'admin' | 'user';
export type RolePermissionsMap = Record<Role, Permission[]>;

export interface RequirePermissionOptions { requireAll?: boolean } // default false
export interface PermissionMetadata { permissions: Permission[]; options: RequirePermissionOptions }
```

## Cookie behavior (summary)

Defined at `controllers/keycloak-auth.controller.ts:21-29`.

| Cookie | HTTP-Only | Secure | SameSite | Path | maxAge | Set by | Cleared by |
|---|---|---|---|---|---|---|---|
| `access_token` | yes | `NODE_ENV==='production'` | `strict` in prod, `lax` otherwise | `/` | `expiresIn * 1000` ms | `/auth/login`, `/auth/refresh` | `/auth/logout`, failed `/auth/refresh` |
| `refresh_token` | yes | `NODE_ENV==='production'` | `strict` in prod, `lax` otherwise | `/` | 30 days | `/auth/login`, `/auth/refresh` | `/auth/logout`, failed `/auth/refresh` |

## Role -> Permission mapping

From `permissions/permissions.constants.ts:29-35`:

| Role | Permissions |
|---|---|
| `admin` | `users:read`, `users:create`, `users:update`, `users:delete`, `conversations:read`, `conversations:create`, `conversations:delete` |
| `user` | `conversations:read`, `conversations:create` |

`getPermissionsForRoles(roles: string[])` unions and dedupes across the supplied roles; unknown roles contribute nothing (`permissions/permissions.constants.ts:51-73`).

## Upstream Keycloak contract (consumed)

Backend acts as a client of the Keycloak `application` realm — full spec at `projects/application/keycloak/.docs/spec.md`. Relevant consumption:

| Endpoint | Purpose | Source |
|---|---|---|
| `POST ${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token` with `grant_type=password` | Login | `services/keycloak-auth.service.ts:32-41` |
| Same endpoint with `grant_type=refresh_token` | Refresh | `services/keycloak-auth.service.ts:70-79` |
| `POST .../openid-connect/logout` | Revoke session via refresh token | `services/keycloak-auth.service.ts:105-114` |

Client credentials default to `backend-service` / `backend-service-secret` in the `application` realm (`services/keycloak-auth.service.ts:15-18`), matching the confidential client defined at `projects/application/keycloak/.docs/spec.md:30-41`.
