# User Management — Flows

All flows share the same pre-controller middleware: `cookie-parser` → CORS → global `KeycloakJwtGuard` (`src/main.ts:9-16`, `src/app.module.ts:23-28`). The JWT guard attaches `request.user` but **does not check permissions**; there is no `PermissionGuard` attached or registered globally for this feature (`controllers/user-management.controller.ts:24-28`). The handlers below therefore run for any authenticated user.

Every service method calls `getAdminAccessToken()` first (`services/user-management.service.ts:417-452`):

1. `POST {KEYCLOAK_BASE_URL}/realms/{realm}/protocol/openid-connect/token` — form body `client_id=backend-service`, `client_secret`, `grant_type=client_credentials`.
2. On non-OK, throws `InternalServerErrorException('Failed to authenticate with Keycloak')` and logs status + body.
3. Returns `access_token` from the JSON response. No caching.

## Flow 1: List users — `GET /users`

1. Client sends `GET /users?page=1&pageSize=10&search=jane&sortBy=email&sortDirection=asc`.
2. Global `KeycloakJwtGuard` validates the cookie/Bearer JWT and attaches `request.user` (`features/keycloak-auth/guards/keycloak-jwt.guard.ts:46-57`). Permission metadata is ignored — no `PermissionGuard` is active.
3. `UserManagementController.getUsers` logs the query and calls `UserManagementService.getUsers(query)` (`controllers/user-management.controller.ts:33-38`).
4. Service applies defaults (`page=1`, `pageSize=10`, `sortBy='username'`, `sortDirection='asc'`) and computes `first = (page-1) * pageSize`, `max = pageSize` (`services/user-management.service.ts:66-83`).
5. Service `GET {base}/admin/realms/{realm}/users?first=0&max=10&search=jane` with `Authorization: Bearer <admin token>`. Non-OK → log + throw `InternalServerErrorException('Failed to fetch users')` (`:91-107`).
6. Service `GET {base}/admin/realms/{realm}/users/count?search=jane`. Non-OK → warn and use `keycloakUsers.length` as `total` (`:117-133`).
7. For each user, `mapKeycloakUserToDto` calls `getUserRoles(userId)` → `GET /users/{id}/role-mappings/realm`, maps `role.name`, and filters through `ROLES = ['admin','user']` (`:457-507`).
8. Service sorts in-memory by `sortBy`; strings via `localeCompare`, numbers via subtraction, `asc` default (`:141-155`).
9. Returns `{ users, pagination: { page, pageSize, total, totalPages: Math.ceil(total/pageSize) } }` (`:157-165`).
10. Outer `catch` re-throws `InternalServerErrorException`; any other error is logged and wrapped as `InternalServerErrorException('Failed to fetch users')` (`:166-172`).

## Flow 2: Get one user — `GET /users/:id`

1. Controller logs and calls `UserManagementService.getUserById(id)` (`controllers/user-management.controller.ts:43-48`).
2. Service fetches admin token, then `GET {base}/admin/realms/{realm}/users/{id}` (`services/user-management.service.ts:182-190`).
3. `status === 404` → `NotFoundException('User with ID {id} not found')` (`:192-194`).
4. Other non-OK → log + `InternalServerErrorException('Failed to fetch user')` (`:196-200`).
5. On success, calls `mapKeycloakUserToDto` which also issues the realm-role-mappings call, and returns the resulting `UserDto` (`:202-203`).
6. Outer `catch` preserves `NotFoundException` / `InternalServerErrorException` and wraps everything else as `InternalServerErrorException('Failed to fetch user')` (`:204-213`).

## Flow 3: Create user — `POST /users`

1. Controller logs and calls `UserManagementService.createUser(dto)` (`controllers/user-management.controller.ts:53-58`).
2. Service fetches admin token, then `POST {base}/admin/realms/{realm}/users` with body:
   ```json
   { "username": "<email>", "email": "<email>", "firstName": "...", "lastName": "...",
     "enabled": true, "emailVerified": true,
     "credentials": [{ "type": "password", "value": "<temporaryPassword>", "temporary": false }] }
   ```
   (`services/user-management.service.ts:224-247`).
3. `status === 409` → `BadRequestException('User with this username or email already exists')` (`:250-252`).
4. Other non-OK → log + `InternalServerErrorException('Failed to create user')` (`:254-258`).
5. Parse `userId` from the `Location` response header (last path segment). Missing / unparseable → `InternalServerErrorException` (`:261-269`).
6. `assignRoleToUser(userId, dto.role)` (`:272`): looks up `GET /admin/realms/{realm}/roles/{roleName}` (`:517-525`); if not found, log warn and return. Otherwise `POST /users/{userId}/role-mappings/realm` with `[role]` as the body (`:553-564`). Role-assignment HTTP errors are logged but not thrown.
7. Service returns `this.getUserById(userId)` to produce the `UserDto` with roles (`:275`).

## Flow 4: Update user — `PUT /users/:id`

1. Controller logs and calls `UserManagementService.updateUser(id, dto)` (`controllers/user-management.controller.ts:63-71`).
2. Service fetches admin token and `existingUser = getUserById(id)` — propagates 404 if user is missing (`services/user-management.service.ts:293-296`).
3. Service `PUT /users/{id}` with `{ firstName: dto.firstName ?? existingUser.firstName, lastName: dto.lastName ?? existingUser.lastName }` — email and username are never sent (`:299-312`).
4. `status === 404` → `NotFoundException` (`:314-316`). Other non-OK → `InternalServerErrorException('Failed to update user')` (`:318-322`).
5. If `dto.role` was provided AND `existingUser.roles` does not already include it (`:325`):
   - For every role currently on the user that is in `ROLES` (`['admin','user']`), `removeRoleFromUser` issues `DELETE /users/{id}/role-mappings/realm` with `[role]` body (`:327-331`, `:580-613`).
   - `assignRoleToUser(id, dto.role)` attaches the new role (`:333`).
6. Returns `this.getUserById(id)` (`:337`).

## Flow 5: Delete user (soft) — `DELETE /users/:id`

1. Controller logs and calls `UserManagementService.deleteUser(id)`; on success returns `{ message: 'User deleted successfully' }` (`controllers/user-management.controller.ts:76-82`).
2. Service calls `toggleUserEnabled(id, false)` — no Keycloak `DELETE` is issued (`services/user-management.service.ts:354-356`).
3. `NotFoundException` from the toggle propagates unchanged; all other errors become `InternalServerErrorException('Failed to delete user')` (`:358-363`).

## Flow 6: Toggle enabled — `PATCH /users/:id/enabled`

1. Controller logs and calls `UserManagementService.toggleUserEnabled(id, dto.enabled)` (`controllers/user-management.controller.ts:86-97`).
2. Service fetches admin token, then `getUserById(id)` for existence check — 404 propagates as `NotFoundException` (`services/user-management.service.ts:371-374`).
3. Service `PUT /users/{id}` with body `{ enabled }` (`:376-388`).
4. `status === 404` → `NotFoundException` (`:390-392`). Other non-OK → `InternalServerErrorException('Failed to update user status')` (`:394-398`).
5. Returns `this.getUserById(id)` so the response carries the new `enabled` value plus roles (`:401`).
