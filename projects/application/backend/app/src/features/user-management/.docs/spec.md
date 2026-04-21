# User Management — Spec

## Purpose

REST CRUD over Keycloak users. The backend authenticates to Keycloak with a `client_credentials` grant using `backend-service` and proxies the Keycloak Admin API (`/admin/realms/{realm}/users*`) for listing, fetching, creating, updating, disabling, and toggling-enabled on users in the `application` realm (`services/user-management.service.ts:52-60`, `projects/application/keycloak/.docs/spec.md` seeded users). Delete is always soft — users are disabled in Keycloak, never removed (`services/user-management.service.ts:354-364`).

## Behavior

- Exposes six routes under `@Controller('users')` (`controllers/user-management.controller.ts:24`): `GET /users`, `GET /users/:id`, `POST /users`, `PUT /users/:id`, `DELETE /users/:id`, `PATCH /users/:id/enabled`.
- On every service call, obtains an admin access token via `POST {KEYCLOAK_BASE_URL}/realms/{realm}/protocol/openid-connect/token` with `grant_type=client_credentials` (`services/user-management.service.ts:417-452`). No token caching — a fresh token is fetched per request.
- `GET /users` supports `page` (default 1), `pageSize` (default 10), `search`, `sortBy` (default `username`), `sortDirection` (default `asc`). Pagination is translated to Keycloak's `first` (`(page-1)*pageSize`) and `max` (`pageSize`) params (`services/user-management.service.ts:66-88`).
- Total count comes from `GET /admin/realms/{realm}/users/count?search=...`; if that call fails the service falls back to the returned page length (`services/user-management.service.ts:117-133`).
- For each returned user, the service issues `GET /admin/realms/{realm}/users/{id}/role-mappings/realm` and filters names through `ROLES` (`['admin','user']`) so only app roles land on the DTO (`services/user-management.service.ts:478-507`, `features/keycloak-auth/permissions/permissions.constants.ts:40`).
- Sorting is applied client-side after the roles fetch; strings use `localeCompare`, numbers use subtraction, unknown types return `0` (`services/user-management.service.ts:141-155`).
- `POST /users` uses the request's `email` as both Keycloak `username` and `email`, sets `enabled: true`, `emailVerified: true`, and a credential of `{ type: 'password', value: temporaryPassword, temporary: false }` (`services/user-management.service.ts:232-247`). On `409` it throws `BadRequestException('User with this username or email already exists')` (`:250-252`). The new user's ID is parsed from the `Location` response header (`:261-269`), then the requested role (`admin` or `user`) is assigned via `POST .../role-mappings/realm` (`:272`, `:542-575`). The service re-fetches via `getUserById` before returning.
- `PUT /users/:id` first fetches the existing user, then sends `{ firstName, lastName }` with fallbacks to existing values; email/username is never updated (`services/user-management.service.ts:298-312`). If `dto.role` is set and not already on the user, every current app role is removed and the new one assigned (`:325-334`).
- `DELETE /users/:id` delegates to `toggleUserEnabled(id, false)` — no Keycloak DELETE is ever issued (`services/user-management.service.ts:354-356`). Controller returns `{ message: 'User deleted successfully' }` (`controllers/user-management.controller.ts:78-82`).
- `PATCH /users/:id/enabled` first calls `getUserById` to verify existence (propagating 404), then PUTs `{ enabled }` to the Keycloak user, then re-fetches and returns the DTO (`services/user-management.service.ts:369-412`).
- Not-found responses from Keycloak (`status === 404`) map to NestJS `NotFoundException`; all other non-OK responses log the body and throw `InternalServerErrorException` (`services/user-management.service.ts:192-199`, `:314-322`, `:390-398`). Known NestJS exceptions are re-thrown by the outer `catch` blocks so they are not double-wrapped (`:167-172`, `:276-285`, `:338-348`, `:358-363`, `:402-410`).

## Authentication and Authorization — **actual behavior**

- All six handlers carry `@RequirePermission('users:*')` metadata (`controllers/user-management.controller.ts:34,44,54,64,77,88`).
- The controller has **no** `@UseGuards(PermissionGuard)` and the module does **not** register `PermissionGuard` as an `APP_GUARD` (`controllers/user-management.controller.ts:24-28`, `user-management.module.ts:7-13`, `src/app.module.ts:23-28` registers only `KeycloakJwtGuard`).
- Consequence: **every authenticated user can hit every endpoint**. The global `KeycloakJwtGuard` validates the JWT cookie/Bearer, but the permission metadata is inert — no check happens. A `testuser` with realm role `user` can list, create, update, disable, and toggle users.
- `CreateUserDto`, `UpdateUserDto`, etc. are plain TypeScript interfaces (`user-management.types.ts:21-92`) with **no** `class-validator` decorators, and the app registers **no** global `ValidationPipe`. Bodies are passed through to the service unvalidated; malformed requests reach Keycloak and fail there.

See Discrepancies at the end for the intent-vs-reality gap.

## Components / Endpoints / Services

| Part | Purpose | Source |
|---|---|---|
| `UserManagementModule` | Feature module; imports `ConfigModule` + `KeycloakAuthModule`, registers controller + service | `user-management.module.ts:7-13` |
| `UserManagementController` | REST handlers under `/users` | `controllers/user-management.controller.ts:24-98` |
| `UserManagementService` | Wraps Keycloak Admin API; owns token fetch, DTO mapping, role assignment | `services/user-management.service.ts:44-615` |
| `UserDto` / `CreateUserDto` / `UpdateUserDto` / `UserListQueryDto` / `UserListResponseDto` / `ToggleUserEnabledDto` | Plain TS interfaces (no `class-validator`) | `user-management.types.ts:6-92` |
| `Role` type | `'admin' \| 'user'` imported from keycloak-auth | `user-management.types.ts:1`, `keycloak-auth/permissions/permissions.constants.ts:40` |

## Acceptance Criteria

- [ ] `GET /users` returns `{ users, pagination: { page, pageSize, total, totalPages } }` and defaults `page=1`, `pageSize=10`, `sortBy='username'`, `sortDirection='asc'`.
- [ ] `GET /users` passes `first`, `max`, and `search` through to `/admin/realms/{realm}/users` and derives `total` from `/users/count` (falling back to returned length on count failure).
- [ ] `GET /users/:id` returns `UserDto` including `roles` filtered to `['admin','user']`; returns 404 when Keycloak returns 404.
- [ ] `POST /users` uses `email` as both `username` and `email`, sets `emailVerified=true`, stores a non-temporary password, and assigns the requested role by POSTing to `/users/{id}/role-mappings/realm`.
- [ ] `POST /users` returns HTTP 400 with message `User with this username or email already exists` when Keycloak responds 409.
- [ ] `PUT /users/:id` updates only `firstName` and `lastName` in Keycloak (email/username immutable); if `role` provided and differs, removes all existing app roles and assigns the new one.
- [ ] `DELETE /users/:id` sets `enabled=false` in Keycloak (no hard delete) and responds with `{ message: 'User deleted successfully' }`.
- [ ] `PATCH /users/:id/enabled` returns the updated `UserDto` reflecting the new enabled value; returns 404 when the user does not exist.
- [ ] Admin access token is fetched per request via client_credentials against `/realms/{realm}/protocol/openid-connect/token` — there is no token cache.
- [ ] Every handler requires a valid JWT via the global `KeycloakJwtGuard`, but **no permission check runs** — any authenticated user can call any endpoint (see Discrepancies).

## Discrepancies — intent vs. reality

- **Permission guard not wired.** `@RequirePermission('users:*')` is set on every handler (`controllers/user-management.controller.ts:34,44,54,64,77,88`), but `PermissionGuard` is not attached via `@UseGuards` and is not registered as an `APP_GUARD` in `src/app.module.ts:23-28`. `README.md:83-98` and the previous `spec.md` claim permission-based access control, but in the current build every authenticated user can perform every operation. `keycloak-auth/README.md:91` documents the canonical `@UseGuards(KeycloakJwtGuard, PermissionGuard)` pattern that is missing here.
- **DTOs are inert.** `CreateUserDto`, `UpdateUserDto`, `ToggleUserEnabledDto`, and `UserListQueryDto` are plain TypeScript interfaces with no `class-validator` decorators (`user-management.types.ts`), and `src/main.ts` does not register a global `ValidationPipe`. Nothing rejects malformed bodies before the Keycloak call.
- **Update-when-provided-and-different semantics.** `PUT /users/:id` only changes roles when `dto.role` is present AND the user does not already have that role (`services/user-management.service.ts:325`). A user with both `admin` and `user` roles who is sent `role: 'user'` will keep both — the branch is skipped.
- **`getRealmRole` failure is swallowed.** `assignRoleToUser` logs and silently returns when the role lookup fails (`services/user-management.service.ts:548-551`). A created user with an invalid role would succeed at the HTTP layer but have no role assigned.
