# User Management — Test Data

## Seeded Users in Keycloak

From `projects/application/keycloak/app/realm-config/realm-export.json:154-183` and documented in `projects/application/keycloak/.docs/spec.md` (Seeded Users).

| Username | Email | Password | Realm roles | Enabled |
|---|---|---|---|---|
| `testuser` | `test@example.com` | `password` | `user` | true |
| `admin` | `admin@example.com` | `admin` | `user`, `admin` | true |

Both users have `emailVerified=true`. There is no pre-disabled seed account in the realm export.

The `service-account-backend-service` service account is also present but is filtered out of list responses (only realm roles in `['admin', 'user']` are surfaced to the FE via `backend/.../user-management.service.ts:478-507`).

## Default list query

The FE hard-codes the initial query in `pages/users.page.ts:62`:

```ts
private query: UserListQuery = { page: 1, limit: 25 };
```

Effective request: `GET /users?page=1&limit=25`. Backend returns 10 rows (it reads `pageSize`, not `limit`).

## Form inputs — Create user

| Field | Example value | Validators (FE) | Sent to backend? |
|---|---|---|---|
| Username | `jsmith` | required, minLength(3) | Yes — backend ignores |
| Email | `jsmith@example.com` | required, email | Yes — used as `email` |
| Password | `hunter2hunter2` | required, minLength(8) | Yes as `password` — backend expects `temporaryPassword`, so ignored |
| First Name | `Jane` | none | Yes |
| Last Name | `Smith` | none | Yes |
| Roles | `['user']` | required | Yes as `roles[]` — backend expects `role` (singular), so ignored |

Because required backend fields (`temporaryPassword`, `role`) are never sent, create calls will NOT succeed end-to-end. See `spec.md` Discrepancies.

## Form inputs — Edit user

`username` is disabled and not sent as part of the editable fields — but `form.getRawValue()` still includes it. The FE emits `{ username, email, password, firstName, lastName, roles }`; only `firstName` and `lastName` are honored by the backend (`backend/.../user-management.service.ts:298-312`).

## Search scenarios

The backend translates `search` straight through to the Keycloak Admin API, which matches across `username`, `email`, `firstName`, `lastName`.

| Search term | Matches (given seed) |
|---|---|
| `test` | `testuser` |
| `admin` | `admin` |
| `example.com` | `testuser`, `admin` |
| `zzz` | none |
| (empty) | all |

No empty-state UI exists — the table simply renders zero rows.

## Sort scenarios

`sortBy` is passed through but the FE sends `sortOrder` where the backend expects `sortDirection`. Server-side sort direction is always the default `asc`; the only variable is the field.

| `sortBy` sent | Backend behavior |
|---|---|
| `username` | ascending by username |
| `email` | ascending by email |
| `createdTimestamp` | ascending by createdTimestamp |

The FE offers sort headers only for `username`, `email`, `createdAt`. `createdAt` does not match the backend's `createdTimestamp` field name — the sort effectively sends `sortBy=createdAt`, which falls outside the backend union `username|email|firstName|lastName|createdTimestamp`. Backend will likely default to `username`.

## API response example (current backend shape)

```json
GET /users?page=1&limit=25
200 OK
{
  "users": [
    {
      "id": "b1e...",
      "username": "admin",
      "email": "admin@example.com",
      "firstName": "Admin",
      "lastName": "User",
      "enabled": true,
      "createdTimestamp": 1713340800000,
      "roles": ["admin", "user"]
    },
    {
      "id": "5ac...",
      "username": "testuser",
      "email": "test@example.com",
      "firstName": "Test",
      "lastName": "User",
      "enabled": true,
      "createdTimestamp": 1713340800000,
      "roles": ["user"]
    }
  ],
  "pagination": { "page": 1, "pageSize": 10, "total": 2, "totalPages": 1 }
}
```

Note: the FE `User` type declares `createdAt: string` and `updatedAt: string`; these keys are not in the response. The `createdAt` column in the table therefore renders empty (the `date` pipe given `undefined` produces empty string) despite the field being present as `createdTimestamp`.

## Delete response

```json
DELETE /users/<id>
200 OK
{ "message": "User deleted successfully" }
```

The FE subscription in `pages/users.page.ts:94` ignores the body.
