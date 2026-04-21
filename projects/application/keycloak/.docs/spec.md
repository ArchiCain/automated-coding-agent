# Keycloak — Spec

## Purpose

Centralized authentication and authorization service for the `application` stack. Provides a single OIDC realm with test users, realm roles, and a confidential client (`backend-service`) that the backend uses to exchange credentials, validate JWTs, and manage users via the Admin API. The frontend never talks to Keycloak directly — all auth flows go through the backend (`projects/application/backend/app/src/features/keycloak-auth/services/keycloak-auth.service.ts:15-19`).

## Behavior

- Keycloak 23.0.3 runs in dev mode with PostgreSQL as the backing store (`projects/application/keycloak/dockerfiles/Dockerfile:6,47`).
- Listens on port `8080` inside the container; locally exposed on `8081` (per `README.md:54`).
- On startup, a wrapper script waits for PostgreSQL (30 retries × 2s), creates the `keycloak` schema, runs `envsubst` on the realm JSON to substitute `${FRONTEND_URL}`, then starts Keycloak with `start-dev --import-realm` (`app/scripts/startup.sh:33-67`, `dockerfiles/Dockerfile:52`).
- After Keycloak is healthy, the script uses `kcadm` to assign `manage-users`, `view-users`, `query-users` client roles on `realm-management` to the `service-account-backend-service` user. Assignment is idempotent via a `/tmp/.keycloak_roles_configured` marker file (`app/scripts/startup.sh:99-154`).
- Realm `application` is auto-imported from `app/realm-config/realm-export.json` on first startup (`dockerfiles/Dockerfile:31,52`).
- Realm security: `sslRequired=external`, `bruteForceProtected=true` (3 failures → 15 min wait with 60s increment), `verifyEmail=true`, `registrationAllowed=false`, `loginWithEmailAllowed=true` (`app/realm-config/realm-export.json:7-29`).
- Token lifespans: access 300s, SSO idle 1800s, SSO max 36000s, offline idle 2,592,000s, offline max 5,184,000s (`app/realm-config/realm-export.json:17-22`).
- Default realm role `user` is auto-assigned to new users (`app/realm-config/realm-export.json:30`).
- Admin console credentials come from `KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD` (defaults `admin` / `admin`, see `app/scripts/startup.sh:103-104`).

## Realm: `application`

### Roles

| Role | Type | Description | Source |
|---|---|---|---|
| `user` | Realm (default) | Basic user access | `app/realm-config/realm-export.json:33-37` |
| `admin` | Realm | Administrator with full access | `app/realm-config/realm-export.json:38-41` |
| `manage-users`, `view-users`, `query-users` | Client roles on `realm-management` | Granted to `backend-service` service account at startup | `app/scripts/startup.sh:136-143` |

### Client: `backend-service`

| Property | Value | Source |
|---|---|---|
| Client ID | `backend-service` | `app/realm-config/realm-export.json:46` |
| Type | Confidential (`publicClient: false`) | `app/realm-config/realm-export.json:62` |
| Client secret | `backend-service-secret` (dev default) | `app/realm-config/realm-export.json:51` |
| Service account | Enabled | `app/realm-config/realm-export.json:63` |
| Standard flow | Enabled | `app/realm-config/realm-export.json:66` |
| Direct access grants | Enabled (password grant used by backend login) | `app/realm-config/realm-export.json:65` |
| Implicit flow | Disabled | `app/realm-config/realm-export.json:64` |
| Redirect URIs | `http://localhost:3000/*`, `http://localhost:8080/*`, `${FRONTEND_URL}/*` | `app/realm-config/realm-export.json:52-56` |
| Web origins | `http://localhost:3000`, `http://localhost:8080`, `${FRONTEND_URL}` | `app/realm-config/realm-export.json:57-61` |

### Token Mappers (on `backend-service`)

| Mapper | Claim | Source |
|---|---|---|
| `email` | `email` (access, id, userinfo) | `app/realm-config/realm-export.json:84-97` |
| `username` | `preferred_username` (access, id, userinfo) | `app/realm-config/realm-export.json:111-124` |
| `realm roles` | `roles` on access token (multivalued) | `app/realm-config/realm-export.json:99-110` |
| `realm-management client roles` | `resource_access.realm-management.roles` (access only) | `app/realm-config/realm-export.json:125-138` |
| `realm-management audience` | adds `realm-management` to `aud` (access only) | `app/realm-config/realm-export.json:139-149` |

### Seeded Users

| Username | Email | Password | Roles | Source |
|---|---|---|---|---|
| `testuser` | `test@example.com` | `password` | `user` | `app/realm-config/realm-export.json:154-168` |
| `admin` | `admin@example.com` | `admin` | `user`, `admin` | `app/realm-config/realm-export.json:169-183` |
| `service-account-backend-service` | — | (service account) | `realm-management` client roles `manage-users`, `view-users`, `query-users` | `app/realm-config/realm-export.json:184-196` |

## Environment Variables

| Variable | Default | Description | Source |
|---|---|---|---|
| `KC_DB_URL_HOST` | `database` | Postgres host | `app/scripts/startup.sh:8` |
| `KC_DB_URL_PORT` | `5432` | Postgres port | `app/scripts/startup.sh:9` |
| `KC_DB_URL_DATABASE` | `postgres` | Database name | `app/scripts/startup.sh:10` |
| `KC_DB_USERNAME` / `KC_DB_PASSWORD` | `postgres` / `postgres` | DB creds | `app/scripts/startup.sh:11-12` |
| `KC_DB_SCHEMA` | `keycloak` | Schema name | `app/scripts/startup.sh:13` |
| `DATABASE_SSL` | (unset) | `false` disables psql SSL | `app/scripts/startup.sh:18-24` |
| `FRONTEND_URL` | — | Substituted into redirect URIs and web origins | `app/scripts/startup.sh:65-67` |
| `KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD` | `admin` / `admin` | Admin console login | `app/scripts/startup.sh:103-104` |
| `KC_REALM` | `application` | Realm name for post-start role assignment | `app/scripts/startup.sh:101` |
| `KC_CLIENT_ID` | `backend-service` | Client for role assignment | `app/scripts/startup.sh:102` |
| `KC_HTTP_ENABLED`, `KC_HOSTNAME_STRICT(_HTTPS)`, `KC_PROXY=edge`, `KC_HEALTH_ENABLED`, `KC_METRICS_ENABLED`, `KC_DB=postgres` | set in image | Runtime flags | `dockerfiles/Dockerfile:39-49` |

## Acceptance Criteria

- [ ] Realm `application` is imported on first startup from `realm-export.json`.
- [ ] Client `backend-service` exists as confidential with direct-access-grants and standard-flow enabled and service account enabled.
- [ ] Service account `service-account-backend-service` has client roles `manage-users`, `view-users`, `query-users` on `realm-management` after startup, and re-running startup does not duplicate the assignment.
- [ ] Users `testuser` and `admin` exist with the passwords and roles above and `emailVerified=true`.
- [ ] Access tokens for users contain `email`, `preferred_username`, `roles` (realm roles), and `aud` including `realm-management`.
- [ ] Service account tokens include `resource_access.realm-management.roles` with the three admin roles.
- [ ] `${FRONTEND_URL}` placeholders in `redirectUris` and `webOrigins` are replaced with the actual env value before import.
- [ ] Brute-force protection triggers after 3 failed logins (`failureFactor=3`, `maxFailureWaitSeconds=900`).
- [ ] Keycloak health endpoint at `/health` returns healthy (used by the Helm chart liveness/readiness probes).
