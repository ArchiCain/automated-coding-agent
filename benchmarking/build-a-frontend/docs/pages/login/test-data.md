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
