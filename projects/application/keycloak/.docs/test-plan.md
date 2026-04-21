# Keycloak — Test Plan

## Contract Tests

- [ ] Keycloak starts and responds on port 8080 within 120s
- [ ] Admin console accessible at `/admin/` with credentials `admin`/`admin`
- [ ] Token endpoint (`/realms/application/protocol/openid-connect/token`) accepts client credentials for `backend-service` with secret `backend-service-secret`
- [ ] Access tokens contain expected claims: `email`, `preferred_username`, `realm_access.roles`
- [ ] Access token TTL is 5 minutes (300s `exp - iat`)

## Behavior Tests

### Realm Configuration

- [ ] Realm `application` exists after startup
- [ ] SSL required for external connections (`sslRequired: external`)
- [ ] Brute force protection active: 3 failed attempts trigger 15-minute lockout
- [ ] Login with email is allowed
- [ ] User registration is disabled

### Client Configuration

- [ ] Client `backend-service` exists with type confidential
- [ ] Service account is enabled for `backend-service`
- [ ] Standard flow and direct access grants are enabled
- [ ] Redirect URIs include localhost:3000, localhost:8080, and `${FRONTEND_URL}` substitution

### Roles

- [ ] Realm role `user` exists and is a default role
- [ ] Realm role `admin` exists
- [ ] Service account for `backend-service` has client roles: `manage-users`, `view-users`, `query-users` on `realm-management`

### Test Users

- [ ] User `testuser` exists with email `test@example.com`, password `password`, role `user`
- [ ] User `admin` exists with email `admin@example.com`, password `admin`, roles `user` + `admin`

### Token Mappers

- [ ] Access token includes `email` claim from user profile
- [ ] Access token includes `preferred_username` claim
- [ ] Access token includes `realm_access.roles` array with user's realm roles
- [ ] Service account token includes `resource_access.realm-management.roles`

## E2E Scenarios

- [ ] Full startup sequence: wait for PostgreSQL (up to 30 retries at 2s intervals), create `keycloak` schema, substitute `FRONTEND_URL` in realm export, start Keycloak, health check passes, service account roles assigned
- [ ] Auth flow: POST `/auth/login` to backend with valid credentials, receive HTTP-only cookies, GET `/auth/check` returns user profile with roles
- [ ] Direct access grant: obtain token via `grant_type=password` for `testuser`, verify token contains `email` and `realm_access.roles: ["user"]`
- [ ] Admin token: obtain token for `admin` user, verify `realm_access.roles` contains both `user` and `admin`
- [ ] Service account flow: obtain token via `grant_type=client_credentials` for `backend-service`, verify `resource_access.realm-management.roles` contains `manage-users`, `view-users`, `query-users`
- [ ] Brute force: attempt 3 failed logins for `testuser`, verify 4th attempt returns account-locked error
- [ ] Frontend URL substitution: verify redirect URIs in client config contain the actual `FRONTEND_URL` value (not the literal `${FRONTEND_URL}` placeholder)
- [ ] Idempotent role assignment: restart Keycloak container, verify startup script detects marker file and skips role re-assignment

## Verification Commands

```bash
# Get admin token
TOKEN=$(curl -s -X POST "http://localhost:8081/realms/master/protocol/openid-connect/token" \
  -d "grant_type=password&client_id=admin-cli&username=admin&password=admin" | jq -r '.access_token')

# Check realm exists
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8081/admin/realms/application" | jq '.realm'

# Check client exists
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8081/admin/realms/application/clients?clientId=backend-service" | jq '.[0].clientId'

# Check test users
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8081/admin/realms/application/users?username=testuser" | jq '.[0].email'

# Get user token (direct access grant)
curl -s -X POST "http://localhost:8081/realms/application/protocol/openid-connect/token" \
  -d "grant_type=password&client_id=backend-service&client_secret=backend-service-secret&username=admin&password=admin" | jq -r '.access_token' | cut -d. -f2 | base64 -d 2>/dev/null | jq '.realm_access.roles'

# Check service account roles
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8081/admin/realms/application/users?username=service-account-backend-service" | jq '.[0].id'
```
