# Keycloak Auth (Frontend) — Contracts

> Canonical API shape: `projects/application/backend/app/src/features/keycloak-auth/.docs/contracts.md`. This doc describes only the calls the FE actually makes and the types it declares. Anything under "Discrepancies" in `spec.md` is flagged here too.

All calls hit `${AppConfigService.backendUrl}/auth/*` (default `/api/auth/*`; loaded at bootstrap from `public/config.json` — `features/api-client/services/app-config.service.ts:24`). Every request runs through `authInterceptor` which sets `withCredentials: true` (`features/api-client/interceptors/auth.interceptor.ts:15`). The `AuthService` methods also pass `withCredentials: true` explicitly (redundant but present — `auth.service.ts:39,54,69`).

## Calls made by `AuthService`

### `POST /auth/login` (`auth.service.ts:39`)

**Request body** (`types.ts:10-13`):
```typescript
interface LoginCredentials {
  username: string; // required, min length 3 (login-form.component.ts:29)
  password: string; // required (login-form.component.ts:30)
}
```

**Expected 200 response** (typed by `auth.service.ts:39` as `{ message: string; user: User }`):
```typescript
{
  message: string;          // backend sends "Login successful"
  user: User;
}
```

Matches backend contract. The FE persists only `response.user`; `message` is discarded. Cookies `access_token` and `refresh_token` are set by the backend on this response (`backend/.../contracts.md`), observed by the browser only — never read in FE code.

**401 response** — caller reads `err.error?.message` and surfaces it via `AuthService.error()` (`auth.service.ts:47`). Falls back to `'Login failed'`.

### `POST /auth/logout` (`auth.service.ts:54`)

**Request body:** `{}` (empty object literal).

**Response:** Any status. On both `complete` and `error` branches the service clears `_user` and routes to `/login` (`auth.service.ts:55-64`). No body parsing.

### `POST /auth/refresh` (`features/api-client/services/session-management.service.ts:49-55`)

NOT called from `AuthService`. Called by `authInterceptor` (on 401) and by the dormant 4-minute proactive timer. Request body `{}`, response body unused (the interceptor cares about status only).

### `GET /auth/check` (`auth.service.ts:69`)

**Typed by FE as** `Observable<User>` — the FE treats the whole response body as a `User`.

**Backend actually returns** (`backend/.../contracts.md`):
```typescript
{
  authenticated: true;
  user: User;              // id, username, email, roles, firstName?, lastName?
  permissions: Permission[];
}
```

**Discrepancy:** FE does `_user.set(user)` where `user` is the full envelope (`auth.service.ts:70-73`). Because `User` fields (`id`, `username`, `roles`, ...) are top-level-absent on the envelope, `_user().id` / `roles` / etc. end up `undefined`. `isAuthenticated()` still flips to true because the stored object is non-null, which is enough for `authGuard` to admit the user. Permissions are not read from the envelope; they are recomputed from `user.roles` locally (which are undefined after this path, so `permissions()` returns `[]` until a fresh login repopulates `_user` with the flat user object from `/auth/login`).

## Frontend types (exported from `index.ts`)

```typescript
// types.ts
export interface User {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}
// NOTE: `AuthState` is exported but not used by AuthService; the service exposes discrete signals instead.
```

## Frontend permission types (`permissions/permissions.types.ts`)

```typescript
export type Permission =
  | 'users:read'
  | 'users:write'      // FE
  | 'users:delete'
  | 'conversations:read'
  | 'conversations:write'  // FE
  | 'conversations:delete'
  | 'admin:access';    // FE-only

export type Role = 'admin' | 'user' | 'viewer';
```

**Divergence from backend** (`backend/.../contracts.md`):

| FE | Backend |
|---|---|
| `users:write` | `users:create`, `users:update` |
| `conversations:write` | `conversations:create` |
| `admin:access` | (none) |
| `Role = admin \| user \| viewer` | `Role = admin \| user` |

Because `AuthService.permissions()` is computed locally from roles using the FE's `ROLE_PERMISSIONS` (`permissions/permissions.config.ts:3-15`, `auth.service.ts:26-29`), only the FE's string set ever reaches templates and guards. `RequirePermissionDirective` accepts any `Permission` from the FE union; passing a backend-only string would be a type error.

## Role -> permission mapping (FE)

From `permissions/permissions.config.ts:3-15`:

| Role | Permissions |
|---|---|
| `admin` | `users:read`, `users:write`, `users:delete`, `conversations:read`, `conversations:write`, `conversations:delete`, `admin:access` |
| `user` | `conversations:read`, `conversations:write`, `conversations:delete` |
| `viewer` | `conversations:read` |

## Cookies (observed, not manipulated)

| Cookie | Set by | Read by FE? |
|---|---|---|
| `access_token` | Backend on `/auth/login`, `/auth/refresh` | No — HTTP-only |
| `refresh_token` | Backend on `/auth/login`, `/auth/refresh` | No — HTTP-only |

Both cleared by the backend on `/auth/logout` and on a failed `/auth/refresh` (`backend/.../contracts.md`). The FE relies exclusively on the browser auto-sending them because every request has `withCredentials: true`.
