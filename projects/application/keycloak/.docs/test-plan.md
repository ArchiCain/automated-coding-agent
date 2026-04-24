# Keycloak — Test Plan

## Contract Tests

- [ ] Keycloak responds on port 8080 inside the container within 120s of startup (`app/scripts/startup.sh:78-93`).
- [ ] `/health` returns healthy — available for liveness/readiness probing by any orchestrator.
- [ ] Admin console reachable at `http://localhost:8081/admin/` locally with `admin` / `admin` (README.md:54, `app/scripts/startup.sh:103-104`).
- [ ] Token endpoint `POST /realms/application/protocol/openid-connect/token` accepts `grant_type=client_credentials` with `client_id=backend-service` + `client_secret=backend-service-secret` and returns an `access_token` (`app/realm-config/realm-export.json:46-51,65`).
- [ ] Same endpoint accepts `grant_type=password` with the user's credentials for `testuser` / `password` and `admin` / `admin`.
- [ ] Access tokens decode to include claims: `sub`, `email`, `preferred_username`, `roles` (realm roles), `aud` including `realm-management` (`app/realm-config/realm-export.json:83-149`).
- [ ] `exp - iat` on an access token equals 300s (`app/realm-config/realm-export.json:17`).

## Behavior Tests

### Realm configuration

- [ ] Realm `application` exists after startup (`app/realm-config/realm-export.json:3`).
- [ ] `sslRequired=external`, `bruteForceProtected=true`, `verifyEmail=true`, `registrationAllowed=false`, `loginWithEmailAllowed=true` (`app/realm-config/realm-export.json:7-16`).
- [ ] Token lifespans: access 300s, SSO idle 1800s, SSO max 36000s (`app/realm-config/realm-export.json:17-19`).
- [ ] Default role `user` is applied to new users (`app/realm-config/realm-export.json:30`).

### Client configuration

- [ ] `backend-service` exists, `publicClient=false`, `serviceAccountsEnabled=true`, `standardFlowEnabled=true`, `directAccessGrantsEnabled=true`, `implicitFlowEnabled=false` (`app/realm-config/realm-export.json:46-66`).
- [ ] Redirect URIs include `http://localhost:3000/*`, `http://localhost:8080/*`, and a resolved `${FRONTEND_URL}/*` (not the literal placeholder) — verifies `envsubst` ran (`app/scripts/startup.sh:62-67`, `app/realm-config/realm-export.json:52-56`).
- [ ] Web origins similarly resolved (`app/realm-config/realm-export.json:57-61`).

### Roles

- [ ] Realm roles `user` and `admin` exist (`app/realm-config/realm-export.json:33-42`).
- [ ] Service account for `backend-service` has client roles `manage-users`, `view-users`, `query-users` on `realm-management` (`app/scripts/startup.sh:136-143`).
- [ ] Restarting the container does not re-run role assignment when `/tmp/.keycloak_roles_configured` exists (`app/scripts/startup.sh:107-109`).

### Seeded users

- [ ] `testuser` exists with email `test@example.com`, password `password`, `emailVerified=true`, role `user` (`app/realm-config/realm-export.json:154-168`).
- [ ] `admin` exists with email `admin@example.com`, password `admin`, `emailVerified=true`, roles `user` + `admin` (`app/realm-config/realm-export.json:169-183`).

### Token mappers

- [ ] Password-grant access token for `testuser` contains `email=test@example.com`, `preferred_username=testuser`, and `roles` including `user`.
- [ ] Password-grant access token for `admin` contains `roles` with both `user` and `admin`.
- [ ] Client-credentials token for `backend-service` contains `resource_access.realm-management.roles` with `manage-users`, `view-users`, `query-users` and `aud` includes `realm-management`.

## E2E Scenarios

- [ ] Cold start: delete the `keycloak` schema, bring the container up, verify PG wait → schema create → realm import → health → service-account role assignment all complete, and token endpoints work.
- [ ] Warm restart: restart the container; realm import is idempotent and service-account role assignment is skipped via marker file.
- [ ] Backend login proxy: `POST /auth/login` on the backend with `testuser`/`password` returns 200 and sets `access_token` + `refresh_token` HTTP-only cookies (`projects/application/backend/app/src/features/keycloak-auth/controllers/keycloak-auth.controller.ts:43-51`).
- [ ] Backend validation: `GET /auth/check` (authenticated) returns user profile with roles derived from the access token (`projects/application/backend/app/src/features/keycloak-auth/services/keycloak-auth.service.ts:124-143`).
- [ ] Admin role: backend login as `admin`/`admin` yields roles including `admin`.
- [ ] Service account: backend hits Keycloak Admin API using a `client_credentials` token and can list users (proves `manage-users`/`view-users` granted).
- [ ] Brute force: 3 failed logins for `testuser` cause subsequent attempts to be rejected with an account-locked error (`failureFactor=3`, `app/realm-config/realm-export.json:29`).
- [ ] `FRONTEND_URL` substitution: set `FRONTEND_URL=https://example.test`, start container, inspect client and confirm the redirect URI and web origin contain that value.

## Verification Commands

```bash
# Admin-cli token (master realm)
TOKEN=$(curl -s -X POST "http://localhost:8081/realms/master/protocol/openid-connect/token" \
  -d "grant_type=password&client_id=admin-cli&username=admin&password=admin" | jq -r '.access_token')

# Realm exists
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8081/admin/realms/application" | jq '.realm'

# Client exists
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8081/admin/realms/application/clients?clientId=backend-service" | jq '.[0].clientId'

# User password grant (inspect claims)
curl -s -X POST "http://localhost:8081/realms/application/protocol/openid-connect/token" \
  -d "grant_type=password&client_id=backend-service&client_secret=backend-service-secret&username=admin&password=admin" \
  | jq -r '.access_token' | awk -F. '{print $2}' | base64 -d 2>/dev/null | jq '{email, preferred_username, roles, aud}'

# Client-credentials grant (service account)
curl -s -X POST "http://localhost:8081/realms/application/protocol/openid-connect/token" \
  -d "grant_type=client_credentials&client_id=backend-service&client_secret=backend-service-secret" \
  | jq -r '.access_token' | awk -F. '{print $2}' | base64 -d 2>/dev/null | jq '.resource_access'
```
