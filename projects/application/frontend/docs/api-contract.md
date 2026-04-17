# Benchmark Frontend — API Contract

The backend API is already built on NestJS with Keycloak authentication. These endpoints are available and return exactly the shapes documented below.

Base URL: configured via runtime `/config.json` → `{ "apiUrl": "/api" }`

**Authentication model:** HTTP-only cookies. The backend sets `access_token` and `refresh_token` cookies on login. The browser sends them automatically — the frontend never touches tokens directly. Use `GET /api/auth/check` to verify the session and get the current user.

---

## Authentication

### POST /api/auth/login

Authenticate a user via Keycloak. Sets HTTP-only cookies on success.

**Request:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid-string",
    "username": "admin",
    "email": "admin@example.com",
    "roles": ["admin"],
    "firstName": "Admin",
    "lastName": "User"
  }
}
```

**Cookies set:** `access_token`, `refresh_token` (HTTP-only, secure in production, SameSite=strict)

**Response (401):**
```json
{
  "statusCode": 401,
  "message": "Invalid username or password"
}
```

**Notes:**
- Tokens are stored in HTTP-only cookies — **not accessible to JavaScript**
- The browser sends cookies automatically on subsequent requests
- Do NOT store tokens in localStorage or attach Authorization headers manually
- `roles` is an array of strings (e.g. `["admin"]` or `["user"]`)

---

### POST /api/auth/logout

End the current session. Revokes tokens at Keycloak and clears cookies.

**Request:** No body. Uses `refresh_token` from cookies.

**Response (200):**
```json
{
  "message": "Logout successful"
}
```

**Cookies cleared:** `access_token`, `refresh_token`

---

### POST /api/auth/refresh

Refresh the access token using the refresh token cookie.

**Request:** No body. Uses `refresh_token` from cookies.

**Response (200):**
```json
{
  "message": "Token refreshed successfully"
}
```

**Cookies set:** New `access_token`, `refresh_token`

**Response (401):**
```json
{
  "statusCode": 401,
  "message": "Refresh token not found"
}
```

---

### GET /api/auth/check

Validate the current session and get the authenticated user's profile.

**Request:** No body. Uses `access_token` from cookies.

**Response (200):**
```json
{
  "authenticated": true,
  "user": {
    "id": "uuid-string",
    "username": "admin",
    "email": "admin@example.com",
    "roles": ["admin"],
    "firstName": "Admin",
    "lastName": "User"
  },
  "permissions": [
    "users:read",
    "users:create",
    "users:update",
    "users:delete"
  ]
}
```

**Response (401):**
```json
{
  "statusCode": 401,
  "message": "No token provided"
}
```

**Notes:**
- Call this on app bootstrap to check if the user is already logged in
- Call this after a page refresh to restore user state
- `permissions` are resolved server-side from the user's roles — the frontend never maps roles to permissions itself
- If it returns 401, redirect to `/login`

---

## User Management

All user endpoints require authentication + `users:*` permissions (admin role).

### GET /api/users

List users with server-side pagination, search, and sorting.

**Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number (1-indexed) |
| `pageSize` | number | 10 | Items per page |
| `search` | string | — | Search across username, email, firstName, lastName |
| `sortBy` | string | `username` | One of: `username`, `email`, `firstName`, `lastName`, `createdTimestamp` |
| `sortDirection` | string | `asc` | `asc` or `desc` |

**Response (200):**
```json
{
  "users": [
    {
      "id": "uuid-1",
      "username": "admin@example.com",
      "email": "admin@example.com",
      "firstName": "Admin",
      "lastName": "User",
      "enabled": true,
      "createdTimestamp": 1705312800000,
      "roles": ["admin"]
    },
    {
      "id": "uuid-2",
      "username": "testuser@example.com",
      "email": "testuser@example.com",
      "firstName": "Test",
      "lastName": "User",
      "enabled": true,
      "createdTimestamp": 1708435800000,
      "roles": ["user"]
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 42,
    "totalPages": 5
  }
}
```

**Response (403):**
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions"
}
```

---

### GET /api/users/:id

Get a single user's details.

**Response (200):**
```json
{
  "id": "uuid-1",
  "username": "admin@example.com",
  "email": "admin@example.com",
  "firstName": "Admin",
  "lastName": "User",
  "enabled": true,
  "createdTimestamp": 1705312800000,
  "roles": ["admin"]
}
```

**Response (404):**
```json
{
  "statusCode": 404,
  "message": "User not found"
}
```

---

### POST /api/users

Create a new user in Keycloak. Email is used as the username.

**Request:**
```json
{
  "email": "newuser@example.com",
  "firstName": "New",
  "lastName": "User",
  "temporaryPassword": "changeme123",
  "role": "user"
}
```

**Response (201):**
```json
{
  "id": "uuid-new",
  "username": "newuser@example.com",
  "email": "newuser@example.com",
  "firstName": "New",
  "lastName": "User",
  "enabled": true,
  "createdTimestamp": 1713340800000,
  "roles": ["user"]
}
```

**Response (400):**
```json
{
  "statusCode": 400,
  "message": "User with this email already exists"
}
```

**Notes:**
- `email` becomes the Keycloak username (email = username)
- `temporaryPassword` is set as the user's initial password
- `role` must be `"admin"` or `"user"`
- `firstName` and `lastName` are optional

---

### PUT /api/users/:id

Update a user's name or role. Email/username cannot be changed.

**Request:**
```json
{
  "firstName": "Updated",
  "lastName": "Name",
  "role": "admin"
}
```

All fields are optional — send only what you want to change.

**Response (200):** Updated `UserDto` (same shape as GET /api/users/:id)

---

### DELETE /api/users/:id

Soft-delete a user (sets `enabled: false` in Keycloak).

**Response (200):**
```json
{
  "message": "User deleted successfully"
}
```

---

### PATCH /api/users/:id/enabled

Toggle a user's enabled/disabled status.

**Request:**
```json
{
  "enabled": true
}
```

**Response (200):** Updated `UserDto`

---

## Theme

### GET /api/theme

Get the current user's theme preference.

**Response (200):**
```json
{
  "theme": "dark",
  "userId": "uuid-string"
}
```

**Notes:**
- Defaults to `"dark"` if no preference has been set
- Requires authentication (uses user ID from JWT)

---

### PUT /api/theme

Update the current user's theme preference.

**Request:**
```json
{
  "theme": "light"
}
```

**Response (200):**
```json
{
  "theme": "light",
  "userId": "uuid-string"
}
```

**Notes:**
- `theme` must be `"light"` or `"dark"`

---

## Health

### GET /api/health

Basic health check. Public endpoint (no authentication required).

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2026-04-17T08:00:00.000Z",
  "service": "backend"
}
```

**Notes:**
- This is the only health endpoint that exists today
- The smoke tests page should call this and display the result
- Future: this endpoint could be expanded to check downstream services (database, Keycloak, etc.)

---

## Error Responses

All error responses follow this shape:

```json
{
  "statusCode": 400 | 401 | 403 | 404 | 500,
  "message": "Human-readable error message"
}
```

### Frontend error handling:

| Status | Action |
|--------|--------|
| **401** | Attempt token refresh via `POST /api/auth/refresh`. If refresh fails, clear user state and redirect to `/login` |
| **403** | Show snackbar "Access denied" — do not redirect |
| **400** | Show the `message` from the response (it's user-friendly) |
| **404** | Show "Not found" or handle contextually |
| **5xx** | Show snackbar "Something went wrong. Please try again." |

---

## Permission Model

The backend uses role-based permissions. The frontend should check roles from the user profile to show/hide UI elements.

| Role | Relevant Permissions |
|------|---------------------|
| `admin` | `users:read`, `users:create`, `users:update`, `users:delete` |
| `user` | (no user-management permissions) |

**Frontend implications:**
- Users page (`/users`) is only accessible to users with the `admin` role
- Create/Edit/Delete user buttons are only visible to admins
- The nav item for "Users" should only appear for admins
- Non-admin users see only: Welcome and Smoke Tests
