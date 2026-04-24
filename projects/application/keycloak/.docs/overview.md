# Keycloak — Overview

## What This Is

Centralized OIDC identity provider for the `application` stack. Runs Keycloak `23.0.3` in dev mode with a PostgreSQL backend, auto-imports a single realm (`application`) with one confidential client (`backend-service`), two realm roles (`user`, `admin`), and two seeded test users. The backend calls Keycloak server-to-server for login, refresh, logout, and user-admin operations; the frontend never talks to Keycloak directly (`projects/application/backend/app/src/features/keycloak-auth/services/keycloak-auth.service.ts:32-42`).

## Tech Stack

- **Keycloak** 23.0.3 (`dockerfiles/Dockerfile:6`)
- **Database:** PostgreSQL 16 client (`dockerfiles/Dockerfile:3`), `KC_DB=postgres` (`dockerfiles/Dockerfile:45`)
- **Tooling in image:** `psql` (schema bootstrap), `envsubst` (realm-config templating) — both copied from `alpine:3.19` in stage 1 (`dockerfiles/Dockerfile:2-24`)
- **Image startup:** `start-dev --import-realm` via wrapper script (`dockerfiles/Dockerfile:52`)

## Project Layout

```
projects/application/keycloak/
├── app/
│   ├── realm-config/realm-export.json   # Single realm: clients, roles, users, mappers
│   └── scripts/startup.sh               # PG wait → schema → envsubst → start → kcadm role assignment
├── dockerfiles/Dockerfile               # Multi-stage image (Keycloak + psql + envsubst)
└── Taskfile.yml                         # docker-compose lifecycle tasks
```

## Realm Structure (`application`)

| Component | What / Source |
|---|---|
| Realm settings | `sslRequired=external`, `bruteForceProtected=true` (3 failures), `verifyEmail=true`, `registrationAllowed=false`, `loginWithEmailAllowed=true` (`app/realm-config/realm-export.json:7-29`) |
| Token lifespans | access 300s, SSO idle 1800s, SSO max 36000s (`app/realm-config/realm-export.json:17-19`) |
| Realm roles | `user` (default), `admin` (`app/realm-config/realm-export.json:30-42`) |
| Client | `backend-service` — confidential, secret `backend-service-secret`, service-accounts enabled, standard + direct-access grants (`app/realm-config/realm-export.json:44-67`) |
| Redirect URIs / Origins | localhost:3000, localhost:8080, `${FRONTEND_URL}` (substituted at startup) (`app/realm-config/realm-export.json:52-61`) |
| Protocol mappers | `email`, `preferred_username`, realm `roles`, `resource_access.realm-management.roles`, `realm-management` audience (`app/realm-config/realm-export.json:83-149`) |
| Seeded users | `testuser` / `password` → `user`; `admin` / `admin` → `user`+`admin` (`app/realm-config/realm-export.json:153-183`) |
| Service account | `service-account-backend-service` granted `manage-users`, `view-users`, `query-users` on `realm-management` at container startup (`app/scripts/startup.sh:136-143`) |

## Startup Sequence

1. Resolve DB env (`KC_DB_URL_HOST/PORT/DATABASE/USERNAME/PASSWORD`, `KC_DB_SCHEMA=keycloak`) and SSL mode (`DATABASE_SSL=false` disables psql SSL) (`app/scripts/startup.sh:7-24`).
2. Wait for Postgres — up to 30 attempts × 2s (`app/scripts/startup.sh:29-42`).
3. `CREATE SCHEMA IF NOT EXISTS keycloak` (`app/scripts/startup.sh:47-56`).
4. `envsubst` realm JSON in place to resolve `${FRONTEND_URL}` (`app/scripts/startup.sh:62-68`).
5. Launch Keycloak (`start-dev --import-realm`) in the background (`app/scripts/startup.sh:73`, `dockerfiles/Dockerfile:52`).
6. Poll TCP `localhost:8080` + `kcadm config credentials` until success (max 120s) (`app/scripts/startup.sh:76-97`).
7. If `/tmp/.keycloak_roles_configured` is absent: assign `manage-users`, `view-users`, `query-users` on `realm-management` to `service-account-backend-service` via `kcadm add-roles`, then create the marker (`app/scripts/startup.sh:107-154`).
8. `wait` on the Keycloak PID (`app/scripts/startup.sh:158`).

## Deploy Model

- **Compose:** runs as the `keycloak` service in `infrastructure/compose/dev/compose.yml`. Exposed on host port `8081`. On the deploy host, `compose.prod.yml` swaps the `build:` block for the GHCR image built by CI.
- **Realm export:** `task keycloak:local:export-realm` dumps the live realm back to `app/realm-config/realm-export.json` (note: `Taskfile.yml:35` writes to `./projects/keycloak/app/realm-config/` — see Discrepancies in the command report).

## How Apps Consume It

- **Backend (`backend-service` client):** reads `KEYCLOAK_BASE_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET` with defaults `http://keycloak:8080`, `application`, `backend-service`, `backend-service-secret` (`projects/application/backend/app/src/features/keycloak-auth/services/keycloak-auth.service.ts:14-19`). Uses `password` grant for user login, `refresh_token` for refresh, `client_credentials` for admin operations, and `jose.decodeJwt` for claim extraction.
- **Frontend:** no direct Keycloak contact — only calls backend `/auth/*` endpoints, which set HTTP-only cookies (`projects/application/backend/app/src/features/keycloak-auth/controllers/keycloak-auth.controller.ts:43-51`).

## Standards

This project has no dedicated `standards/` file — the realm config is a single Keycloak-exported JSON document and scripts are thin shell. Conventions worth knowing:
- Realm JSON is the single source of truth; edits should round-trip through `task keycloak:local:export-realm` rather than hand-editing when possible.
- Env substitution is limited to `envsubst` in `startup.sh` — only vars present in the container environment are resolved.
- Client IDs and the shared client secret are duplicated between `app/realm-config/realm-export.json` and the backend's default config; changes must be made in both places.
