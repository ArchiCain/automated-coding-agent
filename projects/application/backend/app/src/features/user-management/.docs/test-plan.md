# User Management — Test Plan

Scope: six `/users` endpoints. Tests run against a real Keycloak `application` realm with seeded users `testuser` / `password` (role `user`) and `admin` / `admin` (roles `user`, `admin`) (`projects/application/keycloak/.docs/spec.md` → Seeded Users; see `test-data.md`).

## Auth precondition (current behavior)

Because `PermissionGuard` is **not** attached to `UserManagementController` or registered globally (`controllers/user-management.controller.ts:24-28`, `src/app.module.ts:23-28`), every test below is executed **twice** against:

- `testuser` (realm role `user` only) — expected to **succeed** on all six endpoints today.
- `admin` (roles `user` + `admin`) — also expected to succeed.

If/when `PermissionGuard` is wired up, the first column flips: `testuser` should get `403 Insufficient permissions` on every route and `admin` should continue to pass. The tests should record both outcomes so the security regression is visible.

Unauthenticated requests (no cookie, no Bearer) must still return `401 Unauthorized` — this is enforced by the global `KeycloakJwtGuard` (`features/keycloak-auth/guards/keycloak-jwt.guard.ts`).

## Contract tests

- [ ] `GET /users` with no auth → 401.
- [ ] `GET /users` as `testuser` → 200 with shape `{ users: UserDto[], pagination: { page, pageSize, total, totalPages } }` (expect today; flag if 403 after fix).
- [ ] `GET /users?page=1&pageSize=1` → `users.length <= 1`, `pagination.pageSize === 1`, `pagination.totalPages === Math.ceil(total/1)`.
- [ ] `GET /users?search=admin` → all returned users' `username`/`email`/`firstName`/`lastName` match `admin` (Keycloak-side filtering).
- [ ] `GET /users/:id` for the `testuser` id → 200 `UserDto` with `roles: ['user']`.
- [ ] `GET /users/:id` for `00000000-0000-0000-0000-000000000000` → 404 with message `User with ID 00000000-... not found`.
- [ ] `POST /users` happy path → 201 `UserDto`; created user visible on `GET /users?search=<email>`.
- [ ] `POST /users` with duplicate email → 400 `User with this username or email already exists`.
- [ ] `PUT /users/:id` with `{ firstName: 'X' }` → 200, `UserDto.firstName === 'X'`, `email` unchanged.
- [ ] `PUT /users/:id` with `{ role: 'admin' }` on a `user` → 200, returned `roles` includes `'admin'`, excludes `'user'` (prior app role removed — `services/user-management.service.ts:325-334`).
- [ ] `DELETE /users/:id` → 200 `{ message: 'User deleted successfully' }`, and a subsequent `GET /users/:id` returns `UserDto` with `enabled: false`.
- [ ] `DELETE /users/:id` does NOT hard-delete: the user is still retrievable via `GET /users/:id` (confirms soft delete).
- [ ] `PATCH /users/:id/enabled` with `{ enabled: true }` → 200, `UserDto.enabled === true`; toggling back with `false` flips it.
- [ ] Any endpoint with invalid id for which Keycloak returns 404 → 404 response from this API.

## Behavior tests

- [ ] Admin token is fetched per request (no caching): spying on `fetch` shows one call to `/protocol/openid-connect/token` per service invocation (`services/user-management.service.ts:417-452`).
- [ ] `GET /users` sorts client-side by `sortBy`; `sortDirection=desc` reverses the result. Unknown `sortBy` values produce `0` comparisons, preserving Keycloak order (`:141-155`).
- [ ] `GET /users` falls back to `keycloakUsers.length` when `/users/count` responds non-OK (`:127-133`).
- [ ] `POST /users` stores the password with `temporary: false` (new user can log in without a forced reset) — verify by hitting the existing `/auth/login` with the supplied password (`services/user-management.service.ts:239-244`).
- [ ] `POST /users` with a `role` value not present in the realm silently completes with no role assigned (`assignRoleToUser` logs a warn and returns — `:547-551`).
- [ ] `PUT /users/:id` omitting `firstName` leaves it unchanged (service fills it from `existingUser.firstName`) (`:308-309`).
- [ ] `PUT /users/:id` with `role` equal to one the user already has is a no-op on roles (`:325`).
- [ ] `UserDto.roles` contains only `admin` / `user` — any non-app realm roles on the user are filtered out (`:498-502`).
- [ ] `UserDto.email` is `''` when Keycloak returns a user with no email (`:466`).

## E2E scenarios

- [ ] **Admin lifecycle:** authenticate as `admin`, create `e2e@example.com` with role `user`, list users and find them, update to role `admin`, toggle `enabled=false`, toggle `enabled=true`, delete (soft), confirm `enabled=false`. All steps 2xx.
- [ ] **Non-admin reality check (current build):** authenticate as `testuser`, repeat the admin lifecycle. Today every step succeeds — record this as a security regression if/when `PermissionGuard` is wired.
- [ ] **Unauthenticated:** call each endpoint with no cookie/Bearer and confirm 401.
- [ ] **Keycloak unreachable:** stop Keycloak, call `GET /users`, expect 500 `Failed to fetch users` (`services/user-management.service.ts:106`, `:171`); bring Keycloak back, call succeeds.

## Discrepancies to surface during test runs

- The previous test-plan.md asserted "Requires `users:*` permission (403 without)" on each endpoint. That is the *intended* behavior, not the current one. Tests should encode both the current (any auth'd user passes) and the intended (only `admin` passes) outcomes so a security fix is easy to detect.
- No input validation: a `POST /users` with missing `email` or missing `temporaryPassword` reaches Keycloak. Consider recording Keycloak's error response as the current contract until validation is added.
