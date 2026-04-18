# User Management Page — Test Data

## Seeded Users in Keycloak

| Email | First Name | Last Name | Role | Enabled | Created |
|-------|------------|-----------|------|---------|---------|
| `admin@example.com` | Admin | User | admin | true | 2026-01-15 |
| `user@example.com` | Regular | User | user | true | 2026-02-20 |
| `jane@example.com` | Jane | Doe | user | true | 2026-03-01 |
| `disabled@example.com` | Disabled | Account | user | false | 2026-03-10 |

## Create User — Valid Inputs

| Field | Value | Notes |
|-------|-------|-------|
| Email | `newuser@example.com` | Must be unique |
| First Name | `New` | Optional |
| Last Name | `User` | Optional |
| Temporary Password | `temppass123` | Required, no complexity rules enforced by frontend |
| Role | `user` | Default selection |

## Create User — Error Scenarios

| Scenario | Input | Expected Response |
|----------|-------|------------------|
| Duplicate email | `admin@example.com` | 400: "User with this email already exists" |
| Missing email | (empty) | Client-side validation: "Required" |
| Invalid email | `notanemail` | Client-side validation: email format error |
| Missing password | (empty) | Client-side validation: "Required" |

## Update User — Valid Inputs

| Field | Original | Updated | Notes |
|-------|----------|---------|-------|
| First Name | Jane | Janet | Optional field |
| Last Name | Doe | Smith | Optional field |
| Role | user | admin | Changes permissions immediately |
| Email | jane@example.com | (read-only) | Cannot be changed |

## Search Scenarios

| Search Term | Expected Results | Notes |
|-------------|-----------------|-------|
| `admin` | admin@example.com | Matches email and firstName |
| `jane` | jane@example.com | Matches firstName |
| `Doe` | jane@example.com | Matches lastName |
| `example.com` | All users | Matches all emails |
| `zzzzzz` | None | Empty state: "No users found" |
| (empty) | All users | Clears filter |

## Sort Scenarios

| Sort By | Direction | First Result |
|---------|-----------|-------------|
| email | asc | admin@example.com |
| email | desc | user@example.com |
| createdTimestamp | asc | admin@example.com (oldest) |
| createdTimestamp | desc | disabled@example.com (newest) |

## Pagination

| Page | Page Size | Expected |
|------|-----------|----------|
| 1 | 5 | First 5 users, paginator shows "1-5 of N" |
| 2 | 5 | Next 5 users |
| 1 | 25 | All users on one page (if < 25 total) |

## API Examples

**List users (page 1):**
```
GET /api/users?page=1&pageSize=10&sortBy=username&sortDirection=asc
Response: 200
{
  "users": [ ... ],
  "pagination": { "page": 1, "pageSize": 10, "total": 4, "totalPages": 1 }
}
```

**Create user:**
```
POST /api/users
Body: { "email": "new@example.com", "firstName": "New", "lastName": "User", "temporaryPassword": "temp123", "role": "user" }
Response: 201
{ "id": "uuid", "username": "new@example.com", "email": "new@example.com", "firstName": "New", "lastName": "User", "enabled": true, "createdTimestamp": 1713340800000, "roles": ["user"] }
```

**Update user:**
```
PUT /api/users/uuid-jane
Body: { "lastName": "Smith", "role": "admin" }
Response: 200
{ "id": "uuid-jane", ... "lastName": "Smith", "roles": ["admin"] }
```

**Delete user:**
```
DELETE /api/users/uuid-jane
Response: 200
{ "message": "User deleted successfully" }
```

**Toggle enabled:**
```
PATCH /api/users/uuid-disabled/enabled
Body: { "enabled": true }
Response: 200
{ "id": "uuid-disabled", ... "enabled": true }
```
