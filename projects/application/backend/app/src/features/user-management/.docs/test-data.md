# User Management — Test Data

Seed users and configuration needed to run the `/users` tests against a live backend + Keycloak stack.

## Keycloak realm

- Realm: `application` (from `KEYCLOAK_REALM`, default `application` — `services/user-management.service.ts:55`).
- Client: `backend-service` confidential, secret `backend-service-secret` (dev default — `services/user-management.service.ts:57-60`, `projects/application/keycloak/app/realm-config/realm-export.json:46-51`).
- Service account (`service-account-backend-service`) is granted `manage-users`, `view-users`, `query-users` client roles on `realm-management` at Keycloak startup (`projects/application/keycloak/app/scripts/startup.sh:136-143`).

## Seed users (from the realm export)

| Username | Email | Password | Realm roles | Source |
|---|---|---|---|---|
| `testuser` | `test@example.com` | `password` | `user` | `projects/application/keycloak/app/realm-config/realm-export.json:154-168` |
| `admin` | `admin@example.com` | `admin` | `user`, `admin` | `projects/application/keycloak/app/realm-config/realm-export.json:169-183` |

`emailVerified` is `true` for both (`realm-export.json:157,172`).

## Environment variables the backend needs

| Var | Default | Where it's read |
|---|---|---|
| `KEYCLOAK_BASE_URL` | `http://keycloak:8080` | `services/user-management.service.ts:53-54` |
| `KEYCLOAK_REALM` | `application` | `:55` |
| `KEYCLOAK_CLIENT_ID` | `backend-service` | `:56-57` |
| `KEYCLOAK_CLIENT_SECRET` | `backend-service-secret` | `:58-59` |

## Login fixture (to obtain JWT cookies for tests)

Use the existing `/auth/login` endpoint (outside this feature — `features/keycloak-auth`) to swap username/password for `access_token` + `refresh_token` cookies, then carry those cookies on `/users*` requests.

```bash
# testuser cookie jar
curl -i -c testuser.cookies \
  -X POST http://localhost:8080/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"testuser","password":"password"}'

# admin cookie jar
curl -i -c admin.cookies \
  -X POST http://localhost:8080/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin"}'
```

## Request fixtures

### Create (valid)
```json
{
  "email": "e2e-user-1@example.com",
  "firstName": "E2E",
  "lastName": "One",
  "temporaryPassword": "Temp-Pass-123!",
  "role": "user"
}
```

### Create (duplicate — expect 400)
Re-POST the same body after the success case; expect:
```json
{ "statusCode": 400, "message": "User with this username or email already exists" }
```

### Update (name only)
```json
{ "firstName": "Renamed" }
```

### Update (role change `user` → `admin`)
```json
{ "role": "admin" }
```

### Toggle enabled
```json
{ "enabled": false }
```

## Expected responses

### UserDto (post-create)
```json
{
  "id": "<uuid>",
  "username": "e2e-user-1@example.com",
  "email": "e2e-user-1@example.com",
  "firstName": "E2E",
  "lastName": "One",
  "enabled": true,
  "createdTimestamp": 1700000000000,
  "roles": ["user"]
}
```

### Paginated list (happy path)
```json
{
  "users": [ { "id": "...", "username": "admin", "roles": ["user","admin"], "...": "..." } ],
  "pagination": { "page": 1, "pageSize": 10, "total": 2, "totalPages": 1 }
}
```

### Not found
```json
{ "statusCode": 404, "message": "User with ID 00000000-0000-0000-0000-000000000000 not found" }
```

### Delete success
```json
{ "message": "User deleted successfully" }
```

## Cleanup between test runs

Because delete is soft (`services/user-management.service.ts:354-356`), E2E-created users persist across runs as disabled records. Two options:

1. Use unique emails per run (e.g. `e2e-user-${Date.now()}@example.com`) and leave the data behind.
2. Hit the Keycloak Admin API directly with a `kcadm` or `curl` + admin token to hard-delete test users between runs — this feature does not expose a hard-delete route.
