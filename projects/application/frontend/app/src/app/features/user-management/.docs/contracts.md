# User Management — Contracts (Frontend)

Everything consumed by `UserManagementApiService` (`services/user-management.api.ts`). Base URL is `${AppConfigService.backendUrl}` (default `/api`). Every call is `withCredentials: true` — the interceptor also sets this, so the per-call flag is redundant (`features/api-client/interceptors/auth.interceptor.ts:15`).

**Auth at the FE callsite:** none enforced. The routes have no `permissionGuard`, `UserManagementApiService` does nothing beyond forwarding `withCredentials`. Any authenticated session cookie suffices; see `spec.md` Discrepancies.

The canonical backend contract (authoritative) lives in `projects/application/backend/app/src/features/user-management/.docs/contracts.md`. This file documents what the **FE sends and expects** — it diverges from the backend in several places that are flagged inline.

## FE-consumed endpoints

### `GET /users`

**Caller:** `UserManagementApiService.getUsers(query?)` (`services/user-management.api.ts:18-27`)

**Query parameters built by FE:**

| Param | Source field | Backend expects |
|---|---|---|
| `search` | `query.search: string` | `search` -- match |
| `page` | `query.page: number` (stringified) | `page` -- match |
| `limit` | `query.limit: number` (stringified) | **`pageSize`** -- MISMATCH (backend ignores `limit`, defaults to 10) |
| `sortBy` | `query.sortBy: string` | `sortBy: 'username'\|'email'\|'firstName'\|'lastName'\|'createdTimestamp'` -- match on name; FE string is unconstrained |
| `sortOrder` | `query.sortOrder: 'asc'\|'desc'` | **`sortDirection`** -- MISMATCH (backend ignores `sortOrder`, defaults to `asc`) |

**FE-expected response:** `UserListResponse` (`types.ts:36-41`):
```typescript
{ users: User[]; total: number; page: number; limit: number }
```

**Backend actual response** (`backend/.../user-management.types.ts:82-85`):
```typescript
{ users: UserDto[]; pagination: { page, pageSize, total, totalPages } }
```

The FE only reads `response.users` (`pages/users.page.ts:100-102`). `response.total|page|limit` are never accessed, so the shape mismatch is latent — no runtime error, but `total` is not available to render a paginator or count.

### `GET /users/:id`

**Caller:** `UserManagementApiService.getUser(id)` (`services/user-management.api.ts:29-31`)
**FE response type:** `User` (see below). Backend returns `UserDto` which has `createdTimestamp: number` and no `updatedAt`; FE type expects `createdAt: string`, `updatedAt: string`. The `UsersTableComponent` pipes `createdAt` through `date:'short'` (`users-table.component.html:23`) — a number will still produce a valid Date, but the field name never matches and the FE type is wrong.

### `POST /users`

**Caller:** `UserManagementApiService.createUser(data)` (`services/user-management.api.ts:33-35`)

**FE request body** (`CreateUserRequest`, `types.ts:12-19`):
```typescript
{
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  roles: string[];   // default ['user']; options ['admin','user','viewer']
}
```

**Backend expects** (`backend/.../user-management.types.ts:21-27`):
```typescript
{
  email: string;
  firstName?: string;
  lastName?: string;
  temporaryPassword: string;
  role: 'admin' | 'user';
}
```

MISMATCH: FE sends `username`, `password`, `roles` (array). Backend reads `temporaryPassword`, `role` (singular). Creating a user through this form cannot succeed end-to-end: required backend fields are absent and the body shape fails `services/user-management.service.ts:232-247`.

**FE response type:** `User`.

### `PUT /users/:id`

**Caller:** `UserManagementApiService.updateUser(id, data)` (`services/user-management.api.ts:37-39`)

**FE request body** (`UpdateUserRequest`, `types.ts:21-26`):
```typescript
{
  email?: string;
  firstName?: string;
  lastName?: string;
  roles?: string[];
}
```

**Backend expects** (`backend/.../user-management.types.ts:33-37`):
```typescript
{
  firstName?: string;
  lastName?: string;
  role?: 'admin' | 'user';
}
```

MISMATCH: FE sends `email` (backend ignores — email is immutable in Keycloak per `backend/.../user-management.service.ts:298-312`) and `roles: string[]` (backend reads `role` singular). Name changes will take effect; role changes will be silently dropped.

**FE response type:** `User`.

### `DELETE /users/:id`

**Caller:** `UserManagementApiService.deleteUser(id)` (`services/user-management.api.ts:41-43`)
**Request body:** none.
**FE response type:** `void` (`UsersPage` ignores the returned body; `pages/users.page.ts:94`). Backend actually sends `{ message: 'User deleted successfully' }` (`backend/.../controllers/user-management.controller.ts:81`).
**Semantics:** soft delete — the backend PUTs `{ enabled: false }` instead of hard-deleting (`backend/.../user-management.service.ts:354-356`). The confirmation dialog does not communicate this.

### `PATCH /users/:id/enabled`

**NOT called by the frontend.** The backend exposes this (`backend/.../contracts.md`) but `UserManagementApiService` has no `toggleEnabled` method and `UsersTableComponent` has no toggle control. Enable/disable cannot be driven from this UI today.

## Shared Types (frontend `types.ts`)

```typescript
interface User {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles: string[];        // backend returns ('admin'|'user')[]
  createdAt: string;      // backend returns createdTimestamp: number
  updatedAt: string;      // backend does NOT return this field
}

interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
}

interface UpdateUserRequest {
  email?: string;
  firstName?: string;
  lastName?: string;
  roles?: string[];
}

interface UserListQuery {
  search?: string;
  page?: number;
  limit?: number;          // backend expects pageSize
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';  // backend expects sortDirection
}

interface UserListResponse {
  users: User[];
  total: number;           // backend returns pagination.total
  page: number;            // backend returns pagination.page
  limit: number;           // backend returns pagination.pageSize
}
```

All exported from `features/user-management/index.ts:7`.
