# User Management — Flows

## Flow 1: List Users

1. Client sends `GET /users?page=1&pageSize=10&search=jane&sortBy=email&sortDirection=asc`
2. `KeycloakJwtGuard` validates JWT, `PermissionGuard` checks `users:read`
3. Controller calls `UserManagementService.getUsers(query)`
4. Service calls `getAdminAccessToken()` — client_credentials grant to Keycloak
5. Service builds Keycloak Admin API params: `first=(page-1)*pageSize`, `max=pageSize`, `search=jane`
6. Service GETs `{baseUrl}/admin/realms/{realm}/users?first=0&max=10&search=jane`
7. Service GETs `{baseUrl}/admin/realms/{realm}/users/count?search=jane` for total
8. For each user, service fetches realm role-mappings via `GET .../users/{id}/role-mappings/realm`
9. Service filters roles to only app roles (admin, user)
10. Service sorts results client-side by `sortBy` field and `sortDirection`
11. Returns `{ users: UserDto[], pagination: { page, pageSize, total, totalPages } }`

## Flow 2: Get Single User

1. Client sends `GET /users/:id`
2. Guards validate JWT and `users:read` permission
3. Service gets admin token, GETs `{baseUrl}/admin/realms/{realm}/users/{id}`
4. If 404: throws `NotFoundException`
5. Service fetches roles for the user
6. Returns `UserDto` with id, username, email, firstName, lastName, enabled, createdTimestamp, roles

## Flow 3: Create User

1. Client sends `POST /users` with `{ email, firstName, lastName, temporaryPassword, role }`
2. Guards validate JWT and `users:create` permission
3. Service gets admin token
4. Service POSTs to Keycloak Admin API to create user:
   - `username` = email, `email` = email, `enabled` = true, `emailVerified` = true
   - `credentials` = `[{ type: 'password', value: temporaryPassword, temporary: false }]`
5. If 409: throws `BadRequestException('User with this username or email already exists')`
6. Service extracts new user ID from response `Location` header
7. Service assigns role via `POST .../users/{id}/role-mappings/realm` with role object
8. Service fetches and returns the created user as UserDto

## Flow 4: Update User

1. Client sends `PUT /users/:id` with `{ firstName?, lastName?, role? }`
2. Guards validate JWT and `users:update` permission
3. Service gets admin token, fetches existing user
4. Service PUTs to Keycloak Admin API with updated firstName/lastName
5. If role changed: removes all existing app roles via `DELETE .../role-mappings/realm`, assigns new role via POST
6. Returns updated UserDto

## Flow 5: Delete User (Soft Delete)

1. Client sends `DELETE /users/:id`
2. Guards validate JWT and `users:delete` permission
3. Controller calls `UserManagementService.deleteUser(id)`
4. Service calls `toggleUserEnabled(id, false)` — disables user in Keycloak
5. Returns `{ message: "User deleted successfully" }`

## Flow 6: Toggle Enabled

1. Client sends `PATCH /users/:id/enabled` with `{ enabled: true|false }`
2. Guards validate JWT and `users:update` permission
3. Service gets admin token, verifies user exists via `getUserById(id)`
4. Service PUTs to Keycloak Admin API with `{ enabled }` body
5. Returns updated UserDto reflecting new enabled state
