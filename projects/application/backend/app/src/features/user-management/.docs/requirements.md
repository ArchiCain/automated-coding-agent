# User Management — Requirements

## What It Does

Full CRUD for users via the Keycloak Admin API. Uses a service account with `manage-users`, `view-users`, and `query-users` roles.

## Endpoints

| Method | Route | Permission | Description |
|--------|-------|------------|-------------|
| GET | `/users` | `users:read` | List users with pagination, search, sorting |
| GET | `/users/:id` | `users:read` | Get single user by ID |
| POST | `/users` | `users:create` | Create user with temporary password and role |
| PUT | `/users/:id` | `users:update` | Update user name and role |
| DELETE | `/users/:id` | `users:delete` | Soft delete (disable user in Keycloak) |
| PATCH | `/users/:id/enabled` | `users:update` | Toggle user enabled/disabled |

## Query Parameters (GET /users)

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `pageSize` | number | 10 | Items per page |
| `search` | string | — | Search by username, email, name |
| `sortBy` | string | — | Sort field |
| `sortDirection` | 'asc' \| 'desc' | 'asc' | Sort direction |

## Create User Request

```typescript
{
  email: string,
  firstName?: string,
  lastName?: string,
  temporaryPassword: string,
  role: 'admin' | 'user'
}
```

## Acceptance Criteria

- [ ] All endpoints require appropriate permission
- [ ] Delete disables user in Keycloak (no hard delete)
- [ ] Created users must change password on first login
- [ ] Role assignment maps to Keycloak realm roles
- [ ] Pagination returns total count for frontend
