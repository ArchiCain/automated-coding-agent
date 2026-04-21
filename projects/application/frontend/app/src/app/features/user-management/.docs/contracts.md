# User Management — Contracts

> Canonical API contract is defined in: `backend/app/src/features/user-management/.docs/contracts.md`

## Frontend-Specific Types

```typescript
// types.ts
interface User {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
  createdAt: string;
  updatedAt: string;
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
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
}
```

## API Usage

- `GET /users` — with query params, returns `UserListResponse`
- `GET /users/:id` — returns `User`
- `POST /users` — sends `CreateUserRequest`, returns `User`
- `PUT /users/:id` — sends `UpdateUserRequest`, returns `User`
- `DELETE /users/:id` — returns void
- All requests use `withCredentials: true`

## Type Divergence Note

The frontend types differ slightly from the backend DTOs:
- Frontend uses `createdAt`/`updatedAt` (strings) vs backend `createdTimestamp` (number)
- Frontend uses `roles: string[]` vs backend `roles: Role[]` (typed union)
- Frontend `CreateUserRequest` uses `password` vs backend `temporaryPassword`
- Frontend `UserListQuery` uses `limit` vs backend `pageSize`

These differences are handled by the API layer mapping.
