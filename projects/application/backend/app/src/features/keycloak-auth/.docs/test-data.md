# Keycloak Auth — Test Data

All credentials are seeded by the `application` realm import; canonical source is `projects/application/keycloak/.docs/spec.md` (`app/realm-config/realm-export.json:154-196`). The backend defaults in `services/keycloak-auth.service.ts:15-18` line up with this realm.

## Environment (local dev)

| Variable | Value | Source |
|---|---|---|
| `KEYCLOAK_BASE_URL` | `http://keycloak:8080` (in-cluster) | `services/keycloak-auth.service.ts:15` |
| `KEYCLOAK_REALM` | `application` | `services/keycloak-auth.service.ts:16` |
| `KEYCLOAK_CLIENT_ID` | `backend-service` | `services/keycloak-auth.service.ts:17` |
| `KEYCLOAK_CLIENT_SECRET` | `backend-service-secret` | `services/keycloak-auth.service.ts:18`, `projects/application/keycloak/.docs/spec.md:35` |
| `NODE_ENV` | `development` for dev tests (controls cookie `secure`/`sameSite`) | `controllers/keycloak-auth.controller.ts:21-29` |

## Seeded Test Accounts (from realm export)

| Username | Password | Email | Realm roles | Expected permissions (`getPermissionsForRoles`) |
|---|---|---|---|---|
| `testuser` | `password` | `test@example.com` | `user` | `conversations:read`, `conversations:create` |
| `admin` | `admin` | `admin@example.com` | `user`, `admin` | all 7: `users:read/create/update/delete`, `conversations:read/create/delete` |

Both users have `emailVerified=true` in the export, so the password grant succeeds without the email-verify flow blocking.

## Example request/response bodies

### `POST /auth/login` — success (testuser)
Request:
```json
{ "username": "testuser", "password": "password" }
```
Response (`200`):
```json
{
  "message": "Login successful",
  "user": {
    "id": "<uuid from Keycloak>",
    "username": "testuser",
    "email": "test@example.com",
    "roles": ["user", "default-roles-application", "offline_access", "uma_authorization"],
    "firstName": "Test",
    "lastName": "User"
  }
}
```
`roles` include realm defaults; what matters for permission resolution is the `user` role. Additional roles present in the JWT are ignored by `getPermissionsForRoles` (unknown → empty).

### `POST /auth/login` — failure
Response (`401`):
```json
{ "statusCode": 401, "message": "Invalid credentials", "error": "Unauthorized" }
```

### `GET /auth/check` — success (admin)
Response (`200`):
```json
{
  "authenticated": true,
  "user": {
    "id": "<uuid>",
    "username": "admin",
    "email": "admin@example.com",
    "roles": ["admin", "user", "default-roles-application", "offline_access", "uma_authorization"]
  },
  "permissions": [
    "users:read", "users:create", "users:update", "users:delete",
    "conversations:read", "conversations:create", "conversations:delete"
  ]
}
```
Order of `permissions` matches insertion order from `ROLE_PERMISSIONS` iteration over the user's roles (`permissions/permissions.constants.ts:62-73`); for admin it comes entirely from the `admin` bucket.

### `POST /auth/refresh` — missing cookie
Response (`401`):
```json
{ "statusCode": 401, "message": "Refresh token not found", "error": "Unauthorized" }
```

### `POST /auth/refresh` — invalid refresh token
Response (`401`):
```json
{ "statusCode": 401, "message": "Failed to refresh token", "error": "Unauthorized" }
```
`Set-Cookie` headers in the response clear both `access_token` and `refresh_token`.

## Cookie assertion templates

| Assertion | Expected (development) | Expected (production) |
|---|---|---|
| `access_token` `HttpOnly` | true | true |
| `access_token` `Secure` | false | true |
| `access_token` `SameSite` | `Lax` | `Strict` |
| `access_token` `Max-Age` | `tokens.expires_in` (seconds) — typically `300` from realm config (`projects/application/keycloak/.docs/spec.md:15`) | same |
| `refresh_token` `Max-Age` | `2592000` (30 days) | same |
| `Path` | `/` | `/` |
