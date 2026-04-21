# User Management — Contracts

All routes live under `@Controller('users')` (`controllers/user-management.controller.ts:24`).

## Auth note (applies to every endpoint)

- **Required in practice:** Valid JWT (cookie `access_token` or `Authorization: Bearer ...`). Enforced by the global `KeycloakJwtGuard` registered as `APP_GUARD` in `src/app.module.ts:23-28`.
- **Declared but not enforced:** `@RequirePermission('users:*')` decorators are present on every handler (`controllers/user-management.controller.ts:34,44,54,64,77,88`) but `PermissionGuard` is neither attached via `@UseGuards` on this controller nor registered globally. The permission check does not run — any authenticated caller can invoke any endpoint. See `spec.md` → Discrepancies.
- **Request validation:** None. DTO types are plain TypeScript interfaces (`user-management.types.ts`) with no `class-validator` decorators, and `main.ts` does not register a global `ValidationPipe`. Bodies are passed through to the Keycloak Admin API as-is.

## Endpoints

### `GET /users`

**Declared permission:** `users:read` (not enforced)
**Query parameters** (`user-management.types.ts:52-63`):
```typescript
{
  page?: number;              // default 1, 1-indexed
  pageSize?: number;          // default 10
  search?: string;            // Keycloak `search` param — matches username, email, firstName, lastName
  sortBy?: 'username' | 'email' | 'firstName' | 'lastName' | 'createdTimestamp'; // default 'username'
  sortDirection?: 'asc' | 'desc'; // default 'asc'
}
```
All query params arrive as strings from Express; no coercion happens in the controller, so `page`/`pageSize` enter the service as strings and the arithmetic in `services/user-management.service.ts:81` relies on JS string coercion.

**Response 200** (`user-management.types.ts:82-85`):
```typescript
{
  users: UserDto[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;     // from Keycloak /users/count, or page length if that call fails
    totalPages: number; // Math.ceil(total / pageSize)
  };
}
```

**Errors:** `500 { statusCode: 500, message: 'Failed to fetch users' }` on any Keycloak failure (`services/user-management.service.ts:106`, `:171`).

### `GET /users/:id`

**Declared permission:** `users:read` (not enforced)
**Response 200:** `UserDto`
**Errors:**
- `404 { statusCode: 404, message: 'User with ID {id} not found' }` (`services/user-management.service.ts:193`)
- `500 { statusCode: 500, message: 'Failed to fetch user' }` (`:199`, `:212`)

### `POST /users`

**Declared permission:** `users:create` (not enforced)
**Request** (`user-management.types.ts:21-27`):
```typescript
{
  email: string;
  firstName?: string;
  lastName?: string;
  temporaryPassword: string;
  role: 'admin' | 'user';
}
```
- `email` becomes both `username` and `email` in Keycloak.
- Credential is created as `{ type: 'password', value: temporaryPassword, temporary: false }` — despite the DTO name, users are **not** forced to change it on first login (`services/user-management.service.ts:239-244`).

**Response 201:** `UserDto` (re-fetched via `getUserById` after creation).

**Errors:**
- `400 { statusCode: 400, message: 'User with this username or email already exists' }` when Keycloak returns 409 (`services/user-management.service.ts:251`).
- `500 { statusCode: 500, message: 'Failed to create user' }` for other Keycloak failures or missing `Location` header (`:257`, `:263`, `:268`, `:284`).

### `PUT /users/:id`

**Declared permission:** `users:update` (not enforced)
**Request** (`user-management.types.ts:33-37`):
```typescript
{
  firstName?: string;
  lastName?: string;
  role?: 'admin' | 'user';
}
```
- Missing `firstName`/`lastName` fall back to the existing user's values (`services/user-management.service.ts:308-309`).
- `role` is only changed when provided AND the user does not already have it (`:325`). A user carrying both `admin` and `user` roles is not normalized.

**Response 200:** `UserDto` (re-fetched).

**Errors:**
- `404 { statusCode: 404, message: 'User with ID {id} not found' }` (`services/user-management.service.ts:193` via `getUserById`, and `:315`).
- `500 { statusCode: 500, message: 'Failed to update user' }` (`:321`, `:347`).

### `DELETE /users/:id`

**Declared permission:** `users:delete` (not enforced)
**Request body:** none.
**Response 200:**
```typescript
{ message: 'User deleted successfully' }
```
(`controllers/user-management.controller.ts:81`)

Implementation disables the user (`PUT .../users/{id}` with `{ enabled: false }`) — **no hard delete** is ever sent to Keycloak (`services/user-management.service.ts:354-356`).

**Errors:**
- `404 { statusCode: 404, message: 'User with ID {id} not found' }` (`:391`).
- `500 { statusCode: 500, message: 'Failed to delete user' }` or `'Failed to update user status'` (`:362`, `:397`).

### `PATCH /users/:id/enabled`

**Declared permission:** `users:update` (not enforced)
**Request** (`user-management.types.ts:90-92`):
```typescript
{ enabled: boolean }
```
**Response 200:** `UserDto` reflecting the new `enabled` value.
**Errors:**
- `404 { statusCode: 404, message: 'User with ID {id} not found' }` (`services/user-management.service.ts:374` / `:391`).
- `500 { statusCode: 500, message: 'Failed to update user status' }` (`:397`, `:410`).

## Shared Types

Exported from `user-management.types.ts` (via `index.ts:1-4`).

```typescript
type Role = 'admin' | 'user';
type SortDirection = 'asc' | 'desc';
type UserSortField =
  | 'username' | 'email' | 'firstName' | 'lastName' | 'createdTimestamp';

interface UserDto {
  id: string;
  username: string;
  email: string;          // '' if Keycloak omits it (service maps `email || ''`, service.ts:466)
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  createdTimestamp?: number;
  roles: Role[];          // filtered to ['admin','user'] — other realm roles are dropped
}

interface CreateUserDto {
  email: string;
  firstName?: string;
  lastName?: string;
  temporaryPassword: string;
  role: Role;
}

interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  role?: Role;
}

interface UserListQueryDto {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: UserSortField;
  sortDirection?: SortDirection;
}

interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface UserListResponseDto {
  users: UserDto[];
  pagination: PaginationMeta;
}

interface ToggleUserEnabledDto {
  enabled: boolean;
}
```

## Upstream Keycloak calls (non-exported, but contract-relevant)

| Purpose | Method + path | Source |
|---|---|---|
| Admin token | `POST /realms/{realm}/protocol/openid-connect/token` (form: client_credentials) | `services/user-management.service.ts:424-433` |
| List users | `GET /admin/realms/{realm}/users?first=&max=&search=` | `:91-99` |
| User count | `GET /admin/realms/{realm}/users/count?search=` | `:117-125` |
| Get user | `GET /admin/realms/{realm}/users/{id}` | `:182-190` |
| Create user | `POST /admin/realms/{realm}/users` | `:224-248` |
| Update user | `PUT /admin/realms/{realm}/users/{id}` | `:299-312`, `:376-388` |
| Realm role-mappings for user | `GET /admin/realms/{realm}/users/{id}/role-mappings/realm` | `:480-488` |
| Lookup realm role by name | `GET /admin/realms/{realm}/roles/{roleName}` | `:517-525` |
| Assign realm role | `POST /admin/realms/{realm}/users/{id}/role-mappings/realm` (body `[role]`) | `:553-564` |
| Remove realm role | `DELETE /admin/realms/{realm}/users/{id}/role-mappings/realm` (body `[role]`) | `:591-601` |

Keycloak env: `KEYCLOAK_BASE_URL` (default `http://keycloak:8080`), `KEYCLOAK_REALM` (default `application`), `KEYCLOAK_CLIENT_ID` (default `backend-service`), `KEYCLOAK_CLIENT_SECRET` (default `backend-service-secret`) — `services/user-management.service.ts:52-60`.
