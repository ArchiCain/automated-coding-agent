# Auth — Contracts

## Endpoints

### `POST /auth/login`
**Auth:** Public
**Request:**
```typescript
{ username: string; password: string }
```
**Response (200):**
```typescript
{
  authenticated: true;
  user: {
    id: string;
    username: string;
    email: string;
    firstName?: string;
    lastName?: string;
    roles: string[];
  };
  permissions: string[];
}
```
**Cookies Set:**
- `access_token` — HTTP-only, Secure, SameSite=Lax, Path=/
- `refresh_token` — HTTP-only, Secure, SameSite=Lax, Path=/

**Error (401):**
```typescript
{ authenticated: false; message: string }
```

### `POST /auth/logout`
**Auth:** Public (reads refresh_token cookie)
**Request:** Empty body
**Response (200):**
```typescript
{ message: "Logged out successfully" }
```
**Cookies Cleared:** `access_token`, `refresh_token`

### `POST /auth/refresh`
**Auth:** Cookie (refresh_token)
**Request:** Empty body
**Response (200):**
```typescript
{ authenticated: true }
```
**Cookies Set:** New `access_token` cookie

**Error (401):**
```typescript
{ message: "Refresh failed" }
```

### `GET /auth/check`
**Auth:** JWT required (access_token cookie or Authorization header)
**Response (200):**
```typescript
{
  authenticated: true;
  user: {
    id: string;
    username: string;
    email: string;
    firstName?: string;
    lastName?: string;
    roles: string[];
  };
  permissions: string[];
}
```
**Error (401):** No body, status code only

## Shared Types

```typescript
interface AuthUser {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
}

interface AuthCheckResponse {
  authenticated: boolean;
  user?: AuthUser;
  permissions: string[];
}

type Permission =
  | 'users:read'
  | 'users:create'
  | 'users:update'
  | 'users:delete'
  | 'conversations:read'
  | 'conversations:create'
  | 'conversations:delete';
```

## Role → Permission Mapping

| Role | Permissions |
|------|------------|
| `admin` | users:read, users:create, users:update, users:delete, conversations:read, conversations:create, conversations:delete |
| `user` | conversations:read, conversations:create |

## Cookie Behavior

| Cookie | HTTP-Only | Secure | SameSite | Path | Set On | Cleared On |
|--------|-----------|--------|----------|------|--------|------------|
| `access_token` | yes | yes | Lax | / | login, refresh | logout |
| `refresh_token` | yes | yes | Lax | / | login | logout |
