# Auth Feature — Test Data

## Test Accounts

| Email | Password | Role | Permissions |
|-------|----------|------|-------------|
| `admin@example.com` | `admin123` | admin | users:read, users:create, users:update, users:delete, conversations:read, conversations:create, conversations:delete |
| `user@example.com` | `user123` | user | conversations:read, conversations:create |

## Permission Model

Permissions are resolved server-side. The frontend receives them from `GET /api/auth/check`.

| Permission | What it controls in the frontend |
|------------|--------------------------------|
| `users:read` | Access to `/users` route, "Users" nav item visibility, User Management feature card on welcome page |
| `users:create` | "Create User" button visibility on users page |
| `users:update` | Edit form in user detail dialog, enable/disable toggle |
| `users:delete` | "Delete" button in user detail dialog |

## Auth Check Response Examples

**Admin:**
```json
{
  "authenticated": true,
  "user": {
    "id": "uuid-admin",
    "username": "admin@example.com",
    "email": "admin@example.com",
    "roles": ["admin"],
    "firstName": "Admin",
    "lastName": "User"
  },
  "permissions": [
    "users:read", "users:create", "users:update", "users:delete",
    "conversations:read", "conversations:create", "conversations:delete"
  ]
}
```

**Regular user:**
```json
{
  "authenticated": true,
  "user": {
    "id": "uuid-user",
    "username": "user@example.com",
    "email": "user@example.com",
    "roles": ["user"],
    "firstName": "Regular",
    "lastName": "User"
  },
  "permissions": [
    "conversations:read", "conversations:create"
  ]
}
```

**Unauthenticated (no cookie / expired):**
```
GET /api/auth/check
Response: 401
{ "statusCode": 401, "message": "No token provided" }
```

## Cookie Behavior

| Cookie | Set by | HTTP-only | Secure (prod) | SameSite | Max-Age |
|--------|--------|-----------|---------------|----------|---------|
| `access_token` | POST /auth/login, POST /auth/refresh | Yes | Yes | strict (prod) / lax (dev) | Token expiry (from Keycloak) |
| `refresh_token` | POST /auth/login, POST /auth/refresh | Yes | Yes | strict (prod) / lax (dev) | 30 days |

Both cookies are cleared by `POST /auth/logout`.

## Error Scenarios

| Scenario | Trigger | Interceptor Behavior |
|----------|---------|---------------------|
| Expired access token | Any API returns 401 | Refresh → retry original request |
| Expired refresh token | Refresh returns 401 | Redirect to /login |
| Insufficient permissions | API returns 403 | Snackbar "Access denied" |
| Server error | API returns 5xx | Snackbar "Something went wrong" |
| No cookies at all | App bootstrap | checkSession returns null, guard redirects to /login |

---

# Login Page — Test Data

## Test Accounts

These accounts are seeded in Keycloak and available in all environments.

| Email | Password | Role | Permissions | First Name | Last Name |
|-------|----------|------|-------------|------------|-----------|
| `admin@example.com` | `admin123` | admin | users:read, users:create, users:update, users:delete, conversations:read, conversations:create, conversations:delete | Admin | User |
| `user@example.com` | `user123` | user | conversations:read, conversations:create | Regular | User |

## Error Scenarios

| Input | Expected Status | Expected Message |
|-------|----------------|-----------------|
| `admin@example.com` / `wrongpassword` | 401 | "Invalid credentials" |
| `nonexistent@example.com` / `anything` | 401 | "Invalid credentials" |
| Empty email / empty password | No API call | Form validation errors shown |
| `notanemail` / `password` | No API call | Email format validation error |

## API Request/Response

**Success:**
```
POST /api/auth/login
Body: { "username": "admin@example.com", "password": "admin123" }
Response: 200
{
  "message": "Login successful",
  "user": {
    "id": "uuid-admin",
    "username": "admin@example.com",
    "email": "admin@example.com",
    "roles": ["admin"],
    "firstName": "Admin",
    "lastName": "User"
  }
}
Cookies: access_token (HTTP-only), refresh_token (HTTP-only)
```

**Failure:**
```
POST /api/auth/login
Body: { "username": "admin@example.com", "password": "wrong" }
Response: 401
{
  "statusCode": 401,
  "message": "Invalid credentials"
}
```
