# Keycloak Auth — Contracts

> Canonical API contract is defined in: `backend/app/src/features/keycloak-auth/.docs/contracts.md`

## Frontend-Specific Types

```typescript
// types.ts
interface User {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
}

interface LoginCredentials {
  username: string;  // email used as username
  password: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}
```

## Frontend Permission Types

```typescript
// permissions/permissions.types.ts
type Permission =
  | 'users:read'
  | 'users:create'
  | 'users:update'
  | 'users:delete'
  | 'conversations:read'
  | 'conversations:create'
  | 'conversations:delete';
```

## API Usage

- `POST /auth/login` — sends `LoginCredentials`, receives `{ message, user: User }`
- `POST /auth/logout` — empty body, clears session
- `GET /auth/check` — receives `{ authenticated, user: User, permissions: Permission[] }`
- All requests use `withCredentials: true` (cookies sent automatically)

## Key Constraint

Permissions are received from the backend `GET /auth/check` response. The frontend has a local `getPermissionsForRoles()` helper for computed signals, but the backend is the source of truth.
