# Keycloak Auth (Frontend) — Test Data

Test accounts come from the Keycloak `application` realm seed (`projects/application/keycloak/app/realm-config/realm-export.json:154-183`, documented in `projects/application/keycloak/.docs/spec.md`). The FE is a thin consumer — there is no FE-side seed.

## Test Accounts (seeded in realm `application`)

| Username | Password | Email | Keycloak roles | FE permissions (via `ROLE_PERMISSIONS`) |
|---|---|---|---|---|
| `testuser` | `password` | `test@example.com` | `user` | `conversations:read`, `conversations:write`, `conversations:delete` |
| `admin` | `admin` | `admin@example.com` | `user`, `admin` | all 7 FE permissions (admin is a superset) |

Keycloak admin console (for dev setup only, not login to the app): `admin` / `admin` on port 8081 (`keycloak/.docs/spec.md:17`).

> The FE login field is labeled `Username` (`login-form.component.html:3`) and submits `username`, not `email`. Use the values in the `Username` column above.

## Form validation cases (no API calls)

| Input | Result |
|---|---|
| Username empty + touched | `mat-error`: "Username is required" |
| Username `ab` + touched | `mat-error`: "Username must be at least 3 characters" |
| Password empty + touched | `mat-error`: "Password is required" |
| Both empty, click Sign In | Button disabled (`form.invalid`); no API call |
| `notanemail` / `somepass` | Accepted — no email-format validator |

## API request / response examples

### Login success (admin)

```
POST /api/auth/login
Content-Type: application/json
Cookie: (none)
Body: { "username": "admin", "password": "admin" }
```

```
HTTP/1.1 200 OK
Set-Cookie: access_token=<jwt>; HttpOnly; Path=/; SameSite=Lax; Max-Age=300
Set-Cookie: refresh_token=<jwt>; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000
Content-Type: application/json

{
  "message": "Login successful",
  "user": {
    "id": "<keycloak-sub>",
    "username": "admin",
    "email": "admin@example.com",
    "roles": ["admin", "user", "default-roles-application", "offline_access", "uma_authorization"],
    "firstName": "Admin",
    "lastName": "User"
  }
}
```

Exact role list depends on realm defaults; the FE only cares that `"admin"` and/or `"user"` is present for its local permission mapping.

### Login failure

```
POST /api/auth/login
Body: { "username": "admin", "password": "wrong" }

HTTP/1.1 401 Unauthorized
{ "statusCode": 401, "message": "Invalid credentials", "error": "Unauthorized" }
```

`AuthService.error()` -> `"Invalid credentials"` (`auth.service.ts:47`).

### Check session — authenticated

```
GET /api/auth/check
Cookie: access_token=<jwt>

HTTP/1.1 200 OK
{
  "authenticated": true,
  "user": {
    "id": "...", "username": "testuser", "email": "test@example.com",
    "roles": ["user", ...], "firstName": null, "lastName": null
  },
  "permissions": ["conversations:read", "conversations:create"]
}
```

FE stores the whole envelope on `_user` (typed as `User`), so `_user().id`/`roles` become `undefined` — see `contracts.md` "Discrepancy". Post-`checkAuth`, `permissions()` computed from `undefined` roles returns `[]` until the next login.

### Check session — unauthenticated

```
GET /api/auth/check
Cookie: (none or expired)

HTTP/1.1 401 Unauthorized
{ "statusCode": 401, "message": "No token provided", "error": "Unauthorized" }
```

`AuthService.checkAuth()` swallows this in `catchError` and emits `null`; `authGuard` then returns a `UrlTree` to `/login`.

### Logout

```
POST /api/auth/logout
Cookie: access_token=<jwt>; refresh_token=<jwt>
Body: {}

HTTP/1.1 200 OK
Set-Cookie: access_token=; Max-Age=0
Set-Cookie: refresh_token=; Max-Age=0
{ "message": "Logout successful" }
```

FE ignores the body; clears `_user` and routes to `/login` regardless of outcome.

## Cookie behavior (observed)

| Cookie | HttpOnly | Secure (prod) | SameSite | Max-Age |
|---|---|---|---|---|
| `access_token` | yes | yes | `strict` in prod, `lax` otherwise | `expires_in * 1000` ms (Keycloak default 300s) |
| `refresh_token` | yes | yes | `strict` in prod, `lax` otherwise | 30 days |

See `backend/.../keycloak-auth/.docs/contracts.md` for the authoritative definition.

## Runtime config

Tests that hit the real backend need `public/config.json` to resolve to the sandbox's `/api`:

```json
{ "backendUrl": "/api" }
```

Loaded at bootstrap via `provideAppInitializer` (`app.config.ts:17-20`). Accessing `AppConfigService.backendUrl` before `load()` throws (`features/api-client/services/app-config.service.ts`).
