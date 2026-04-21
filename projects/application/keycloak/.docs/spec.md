# Keycloak — Requirements

## What This Is

Keycloak 23.0.3 providing centralized authentication and authorization. Runs in development mode with a PostgreSQL backend. The backend service acts as the auth proxy — the frontend never communicates with Keycloak directly.

## Realm: `application`

### Security Settings

- SSL required for external connections
- Brute force protection: 3 failed attempts → 15 min lockout
- Email verification required
- User registration disabled
- Login with email allowed

### Token Lifespans

| Token | TTL |
|-------|-----|
| Access token | 5 minutes |
| SSO session idle | 30 minutes |
| SSO session max | 10 hours |
| Offline session idle | 30 days |
| Offline session max | 60 days |

## Client: `backend-service`

- **Type:** Confidential (client secret: `backend-service-secret`)
- **Service account:** Enabled (for server-to-server admin API calls)
- **Auth methods:** Standard OAuth2 flow + direct access grants
- **Redirect URIs:** localhost:3000, localhost:8080, `${FRONTEND_URL}`

### Token Mappers

| Mapper | Claim | Description |
|--------|-------|-------------|
| email | `email` | User email in access & ID tokens |
| username | `preferred_username` | Username claim |
| realm roles | `realm_access.roles` | User's realm roles |
| realm-management roles | `resource_access.realm-management.roles` | Service account admin roles |

## Roles

| Role | Type | Description |
|------|------|-------------|
| `user` | Realm (default) | Basic user access |
| `admin` | Realm | Full administrative access |
| `manage-users` | Client (realm-management) | Service account: manage users |
| `view-users` | Client (realm-management) | Service account: view users |
| `query-users` | Client (realm-management) | Service account: query users |

## Test Users

| Username | Email | Password | Roles |
|----------|-------|----------|-------|
| `testuser` | test@example.com | password | user |
| `admin` | admin@example.com | admin | user, admin |

Admin console: `http://localhost:8081/admin/` (admin/admin)

## Startup Process

1. Wait for PostgreSQL (30 retries)
2. Create `keycloak` schema if missing
3. Substitute environment variables in realm export (`${FRONTEND_URL}`)
4. Start Keycloak in dev mode
5. Health check (up to 120s)
6. Assign realm-management roles to service account (idempotent)

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `KC_DB_URL_HOST` | database | PostgreSQL host |
| `KC_DB_URL_PORT` | 5432 | PostgreSQL port |
| `KC_DB_URL_DATABASE` | postgres | Database name |
| `KC_DB_USERNAME` | postgres | DB user |
| `KC_DB_PASSWORD` | postgres | DB password |
| `KC_DB_SCHEMA` | keycloak | Schema name |
| `FRONTEND_URL` | — | Frontend URL for CORS/redirects |
| `KEYCLOAK_ADMIN` | admin | Admin console username |
| `KEYCLOAK_ADMIN_PASSWORD` | admin | Admin console password |

## Auth Flow (How Frontend Uses It)

```
Frontend → POST /auth/login → Backend → Keycloak token endpoint
                                  ↓
                           Sets HTTP-only cookies
                                  ↓
Frontend → GET /auth/check → Backend validates JWT → Returns profile + permissions
```

The frontend never holds tokens in JavaScript. All token handling is cookie-based.

## Acceptance Criteria

- [ ] Realm auto-imports on first startup
- [ ] Service account has manage-users, view-users, query-users roles
- [ ] Test users created with correct roles
- [ ] Brute force protection active
- [ ] Frontend URL substitution works in redirect URIs
