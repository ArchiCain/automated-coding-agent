# User Management — Test Plan

## List Users (`GET /users`)

- [ ] Requires `users:read` permission (403 without)
- [ ] Returns paginated user list with pagination metadata
- [ ] Default pagination: page=1, pageSize=10
- [ ] Search filters by username, email, firstName, lastName
- [ ] Sorting works on all fields (client-side sort after Keycloak fetch)
- [ ] Returns total count for frontend pagination
- [ ] Each user includes roles fetched from Keycloak realm role-mappings

## Get User (`GET /users/:id`)

- [ ] Requires `users:read` permission
- [ ] Returns full UserDto with roles
- [ ] Returns 404 for non-existent user ID

## Create User (`POST /users`)

- [ ] Requires `users:create` permission
- [ ] Creates user in Keycloak with email as username
- [ ] Sets temporary password (non-temporary flag in code)
- [ ] Assigns realm role to user
- [ ] Returns 400 "User with this username or email already exists" on duplicate
- [ ] Returns created UserDto with assigned roles

## Update User (`PUT /users/:id`)

- [ ] Requires `users:update` permission
- [ ] Updates firstName and lastName
- [ ] Updates role: removes old app roles, assigns new role
- [ ] Does not change email/username (immutable)
- [ ] Returns 404 for non-existent user ID
- [ ] Returns updated UserDto

## Delete User (`DELETE /users/:id`)

- [ ] Requires `users:delete` permission
- [ ] Disables user in Keycloak (soft delete)
- [ ] Does NOT hard delete from Keycloak
- [ ] Returns 404 for non-existent user ID
- [ ] Returns `{ message: "User deleted successfully" }`

## Toggle Enabled (`PATCH /users/:id/enabled`)

- [ ] Requires `users:update` permission
- [ ] Enables/disables user in Keycloak
- [ ] Returns updated UserDto reflecting new enabled state
- [ ] Returns 404 for non-existent user ID
