# Keycloak — Spec

## What it is

A Keycloak instance deployed as a service in the dev compose stack that serves as the identity provider for the `application` stack. It owns a single realm named `application` and a single confidential OIDC client named `backend-service`. The frontend never talks to Keycloak directly; only the backend exchanges credentials, validates JWTs, and manages users through it.

## How it behaves

### Startup sequence

When the container starts, a wrapper script waits for PostgreSQL to come up (retrying for about a minute), creates the `keycloak` schema if it isn't there, fills in the deployment's public frontend URL everywhere the realm config needs it, and then launches Keycloak in dev mode with realm auto-import enabled. On first boot the `application` realm is imported from the bundled realm export; on later boots it's already in the database and the import is a no-op. Once Keycloak reports healthy, the script uses the admin CLI to grant the backend's service account the three `realm-management` client roles it needs to administer users. This grant is idempotent — a marker file prevents re-applying it on restart.

### What the realm provides

The `application` realm requires SSL for external requests, allows login by email, disables self-registration, and requires email verification for new accounts. Brute-force protection is on: three failed logins trigger a 15-minute lockout that grows by a minute each subsequent failure. Access tokens live for 5 minutes, SSO sessions idle out after 30 minutes and cap at 10 hours, and offline tokens last up to 60 days. Every new user automatically gets the default realm role `user`.

### What clients, roles, and users exist

The realm defines two realm roles — `user` (the default) and `admin` — plus three client roles on the built-in `realm-management` client (`manage-users`, `view-users`, `query-users`) that the startup script assigns to the backend's service account.

The realm has one OIDC client, `backend-service`. It is confidential, has standard flow and direct-access-grants enabled, has implicit flow disabled, and has its service account enabled. Its allowed redirect URIs and web origins cover localhost development ports plus the deployment's public frontend URL. Its access and ID tokens carry the user's email, preferred username, realm roles (as a `roles` claim), and — for access tokens only — the user's `realm-management` client roles and `realm-management` in the audience.

The realm ships with three users: `testuser` (password `password`, role `user`), `admin` (password `admin`, roles `user` + `admin`), and the `backend-service` service account (which holds the three `realm-management` client roles). All human users are marked email-verified.

### What consumes it

The backend is the only direct consumer. It logs users in via the direct-access-grants password flow, validates incoming JWTs against the realm, and calls the Admin API using its service account to create and manage users. The frontend reaches Keycloak only indirectly, through the backend's `keycloak-auth` feature.

## Acceptance criteria

- [ ] Realm `application` is imported on first startup and remains intact on restart.
- [ ] Client `backend-service` exists as confidential, with standard flow and direct-access-grants enabled, implicit flow disabled, and service account enabled.
- [ ] The `service-account-backend-service` user has the `manage-users`, `view-users`, and `query-users` client roles on `realm-management` after startup.
- [ ] Re-running the startup script does not duplicate the service-account role grants.
- [ ] Users `testuser` and `admin` exist with the documented passwords, roles, and `emailVerified=true`.
- [ ] Access tokens for human users include claims for `email`, `preferred_username`, `roles` (realm roles), and an `aud` that contains `realm-management`.
- [ ] Access tokens for the backend service account include `resource_access.realm-management.roles` with the three admin roles.
- [ ] Deployment-time frontend URL placeholders in the realm's `redirectUris` and `webOrigins` are replaced with the actual value before import.
- [ ] Brute-force protection triggers after 3 failed logins with a 15-minute lockout.
- [ ] The `/health` endpoint reports healthy, so any orchestrator's liveness/readiness probe passes.

## Known gaps

- The Taskfile still references an `export-realm` path that no longer matches the current layout; running that task will fail or export to the wrong place.
- The `backend-service` client secret is a hard-coded dev default baked into both the realm JSON and the backend's config; there is no mechanism to rotate it or inject a real secret at deploy time.
- `compose.prod.yml` sets the GHCR image tag to `${IMAGE_TAG:-latest}`; deploys without an explicit tag pull `:latest`. CI always passes the commit SHA, so this only matters for manual `docker compose pull` on the host.

## Code map

Paths are relative to the repo root.

| Concern | File · lines |
|---|---|
| Base image, realm import flag, entrypoint | `projects/application/keycloak/dockerfiles/Dockerfile:6,31,39-52` |
| Startup: wait for Postgres, create schema, substitute frontend URL, start Keycloak | `projects/application/keycloak/app/scripts/startup.sh:33-67` |
| Startup: post-start kcadm role assignment + idempotency marker | `projects/application/keycloak/app/scripts/startup.sh:99-154` |
| Realm security settings (SSL, brute force, email, registration) | `projects/application/keycloak/app/realm-config/realm-export.json:7-29` |
| Token lifespans | `projects/application/keycloak/app/realm-config/realm-export.json:17-22` |
| Default realm role `user` | `projects/application/keycloak/app/realm-config/realm-export.json:30` |
| Realm roles (`user`, `admin`) | `projects/application/keycloak/app/realm-config/realm-export.json:33-41` |
| Client `backend-service` core config | `projects/application/keycloak/app/realm-config/realm-export.json:46,51,62-66` |
| Client redirect URIs and web origins (with `${FRONTEND_URL}` placeholder) | `projects/application/keycloak/app/realm-config/realm-export.json:52-61` |
| Token mappers: `email`, `username`, realm roles, realm-management client roles, realm-management audience | `projects/application/keycloak/app/realm-config/realm-export.json:84-149` |
| Seeded users `testuser`, `admin`, and `service-account-backend-service` | `projects/application/keycloak/app/realm-config/realm-export.json:154-196` |
| DB and admin environment variable defaults | `projects/application/keycloak/app/scripts/startup.sh:8-24,101-104` |
| Backend-side consumer (only direct caller) | `projects/application/backend/app/src/features/keycloak-auth/services/keycloak-auth.service.ts:15-19` |
