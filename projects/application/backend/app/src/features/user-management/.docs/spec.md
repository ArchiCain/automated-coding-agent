# User Management — Spec

## What it is

A REST API under `/users` for managing people in the `application` realm. A signed-in caller can list users (with pagination, search, and sort), fetch one by id, create a new user with an initial password and a role, update a user's name and role, disable (or re-enable) a user, and "delete" a user — which in practice just disables them. Under the hood the backend talks to Keycloak's Admin API using a service account; users are never hard-deleted.

## How it behaves

### Listing users

A caller asks for a page of users and optionally a search string and a sort. The server defaults to page 1, page size 10, sorted by username ascending. It forwards the search and the translated pagination (`first`, `max`) to Keycloak, then asks Keycloak separately for the total count so the response can report `{ page, pageSize, total, totalPages }`. If the count call fails, the server falls back to the length of the returned page. For each user on the page, the server also fetches that user's realm roles and keeps only the app roles (`admin`, `user`). Sorting is then applied on the server after the roles are attached; strings sort by locale, numbers by subtraction, anything else is left alone.

### Getting one user

A caller asks for a user by id. The server fetches the user from Keycloak, fetches that user's realm roles, filters them down to the app roles, and returns the combined record. If Keycloak says the user does not exist, the caller gets a 404.

### Creating a user

A caller posts an email, first and last name, a password, and a role. The server uses the email as both the Keycloak username and the email, marks the account enabled and email-verified, and stores the given password. After Keycloak accepts the create, the server reads the new user's id from the response `Location` header and assigns the requested role. If Keycloak reports the username or email already exists, the caller gets a 400 with the message "User with this username or email already exists". The response is the freshly fetched record.

### Updating a user

A caller puts changes for a user. Only first name and last name are actually sent to Keycloak — email and username are never changed. If a role is included and the user does not already have that role, the server clears the user's existing app roles and assigns the new one; if the user already has the requested role, the role section is skipped entirely. The response is the updated record.

### Enabling or disabling a user

A caller patches a user's enabled flag. The server first fetches the user to confirm it exists, then updates the enabled flag in Keycloak, then returns the refreshed record. A missing user gives back a 404.

### Deleting a user

A caller deletes a user. The server does not issue a delete to Keycloak — it simply sets the user to disabled. The response is `{ message: 'User deleted successfully' }`.

### Talking to Keycloak

Every incoming request triggers a fresh service-account token fetch against Keycloak's `client_credentials` endpoint. There is no caching — each user operation does at least one token call and one or more admin calls. Keycloak 404s become not-found responses to the caller; any other Keycloak failure is logged and surfaces as an internal server error.

## Acceptance criteria

- `GET /users` returns `{ users, pagination: { page, pageSize, total, totalPages } }` and defaults to page 1, pageSize 10, sortBy username, sortDirection ascending.
- `GET /users` forwards `first`, `max`, and `search` to Keycloak and derives `total` from the count endpoint, falling back to the page length on count failure.
- `GET /users/:id` returns a single user record with roles filtered to `admin` and `user`, and returns 404 when Keycloak does.
- `POST /users` uses the supplied email as both username and email, marks the account enabled and email-verified, stores the given password, and assigns the requested role.
- `POST /users` returns 400 with `User with this username or email already exists` when Keycloak responds 409.
- `PUT /users/:id` updates only first and last name; email and username are immutable.
- `PUT /users/:id` only rewrites roles when a role is supplied and the user does not already have it; otherwise existing roles are untouched.
- `DELETE /users/:id` disables the user in Keycloak (no hard delete) and responds with `{ message: 'User deleted successfully' }`.
- `PATCH /users/:id/enabled` returns the updated record reflecting the new enabled value, and returns 404 when the user does not exist.
- A service-account token is fetched per request via `client_credentials`; there is no token cache.
- Every endpoint requires a valid JWT (via the global JWT guard), but no permission check runs — any authenticated user can call any endpoint (see Known gaps).

## Known gaps

- The `users:*` permission metadata is attached to every handler but no permission guard is wired in — the controller has no `@UseGuards(PermissionGuard)` and the module never registers one as an `APP_GUARD`, so any authenticated user (including a plain `user`) can hit every endpoint. See `controllers/user-management.controller.ts:24-28,34,44,54,64,77,88`, `user-management.module.ts:7-13`, and `src/app.module.ts:23-28` (only the JWT guard is registered).
- There is no input validation: the create, update, toggle, and list-query shapes are plain TypeScript interfaces with no `class-validator` decorators, and the app does not register a global `ValidationPipe`. Malformed bodies pass straight through to Keycloak. See `user-management.types.ts:6-92` and `src/main.ts`.
- `DELETE /users/:id` is always a soft delete — it just sets `enabled=false`. No Keycloak DELETE is ever issued, despite the endpoint name. See `services/user-management.service.ts:354-364`.
- Role assignment fails silently: if the server cannot look up the requested realm role, it logs and returns without assigning anything, so a created user can end up with no role while the HTTP call still reports success. See `services/user-management.service.ts:548-551`.
- Update-role semantics skip the reassign branch whenever the user already has the requested role, so a user with both `admin` and `user` who is sent `role: 'user'` keeps both. See `services/user-management.service.ts:325`.
- List query params are not coerced — `page` and `pageSize` arrive as strings from the URL and are used without conversion, so the defaults kick in only when truly absent. See `user-management.types.ts` (plain-interface query type) and `services/user-management.service.ts:66-88`.
- `POST /users` stores the password with `temporary: false` even though the corresponding DTO field is named to suggest a temporary credential; new users are not forced to change their password on first login. See `services/user-management.service.ts:232-247`.
- The README and older spec describe permission-based access control, but the running build does not enforce it. See `README.md:83-98` and `keycloak-auth/README.md:91` for the intended `@UseGuards(KeycloakJwtGuard, PermissionGuard)` pattern that is missing here.

## Code map

Paths are relative to `projects/application/backend/app/`.

| Concern | File · lines |
|---|---|
| Feature module (imports config + keycloak-auth, registers controller and service) | `src/features/user-management/user-management.module.ts:7-13` |
| REST handlers under `/users` | `src/features/user-management/controllers/user-management.controller.ts:24-98` |
| `@RequirePermission('users:*')` metadata on every handler | `src/features/user-management/controllers/user-management.controller.ts:34,44,54,64,77,88` |
| Keycloak Admin API wrapper: token fetch, DTO mapping, role assignment | `src/features/user-management/services/user-management.service.ts:44-615` |
| Service-account token fetch (per request, no cache) | `src/features/user-management/services/user-management.service.ts:417-452` |
| List: translate page/pageSize to `first`/`max`, forward `search` | `src/features/user-management/services/user-management.service.ts:66-88` |
| List: total from `/users/count` with fallback to page length | `src/features/user-management/services/user-management.service.ts:117-133` |
| Per-user role fetch filtered to `admin` / `user` | `src/features/user-management/services/user-management.service.ts:478-507` |
| App-role constants | `src/features/keycloak-auth/permissions/permissions.constants.ts:40` |
| Sort pass over the returned page | `src/features/user-management/services/user-management.service.ts:141-155` |
| Create: email as username, enabled, email-verified, password with `temporary:false` | `src/features/user-management/services/user-management.service.ts:232-247` |
| Create: 409 → `BadRequestException('User with this username or email already exists')` | `src/features/user-management/services/user-management.service.ts:250-252` |
| Create: parse new id from `Location`, assign role, re-fetch | `src/features/user-management/services/user-management.service.ts:261-272`, `:542-575` |
| Update: only `firstName`/`lastName` sent to Keycloak | `src/features/user-management/services/user-management.service.ts:298-312` |
| Update: role branch (skip when role already held) | `src/features/user-management/services/user-management.service.ts:325-334` |
| Delete = toggleUserEnabled(id, false) | `src/features/user-management/services/user-management.service.ts:354-356` |
| Delete controller response | `src/features/user-management/controllers/user-management.controller.ts:78-82` |
| Patch enabled: verify existence, update, re-fetch | `src/features/user-management/services/user-management.service.ts:369-412` |
| Keycloak 404 → `NotFoundException`; other failures → `InternalServerErrorException` | `src/features/user-management/services/user-management.service.ts:192-199`, `:314-322`, `:390-398` |
| Catch blocks that re-throw known Nest exceptions without double-wrapping | `src/features/user-management/services/user-management.service.ts:167-172`, `:276-285`, `:338-348`, `:358-363`, `:402-410` |
| Plain-interface DTO shapes (no `class-validator`) | `src/features/user-management/user-management.types.ts:6-92` |
| `Role` type (`'admin' \| 'user'`) | `src/features/user-management/user-management.types.ts:1`, `src/features/keycloak-auth/permissions/permissions.constants.ts:40` |
| Global JWT guard registration (no permission guard registered) | `src/app.module.ts:23-28` |
| Role-lookup swallowed failure in `assignRoleToUser` | `src/features/user-management/services/user-management.service.ts:548-551` |
