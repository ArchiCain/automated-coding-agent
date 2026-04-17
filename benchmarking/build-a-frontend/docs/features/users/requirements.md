# Users Feature

**Feature directory:** `src/app/features/users/`
**Page:** `/users` (requires `permissionGuard('users:read')`)

## Purpose

Full CRUD interface for managing Keycloak users. Admin-only. Supports server-side pagination, search, sorting, user creation, editing, deletion, and enable/disable toggle.

## Components

- **CreateUserDialog** — modal form for creating users (email, firstName, lastName, temporaryPassword, role). Email required + email validation. Role defaults to "user".
- **UserDetailDialog** — modal for viewing/editing a user. Email read-only. Edit firstName, lastName, role. Delete button with confirmation (only if `users:delete` permission).
- **ConfirmDialog** — generic confirmation for destructive actions. Accepts title, message, confirm label, and color.

## Acceptance Criteria

### Table
- [ ] `mat-table` with columns: Email, First Name, Last Name, Role, Status, Created
- [ ] Server-side sorting on all columns via `matSort` + `(matSortChange)`
- [ ] Server-side pagination via `mat-paginator` (page sizes: 5, 10, 25)
- [ ] Loading spinner while fetching data
- [ ] "No users found" empty state when search/filter matches nothing

### Search
- [ ] `mat-form-field` search input above the table
- [ ] Server-side search (debounced 300ms) across username, email, firstName, lastName
- [ ] Resets to page 1 when search changes

### Role display
- [ ] Role displayed as `mat-chip` with color coding (admin = blue #42a5f5, user = gray #78909c)

### Status display
- [ ] `mat-slide-toggle` in each row showing enabled/disabled state
- [ ] Toggle calls `PATCH /api/users/:id/enabled`
- [ ] Snackbar feedback on success/failure

### Create user
- [ ] "Create User" button above the table (visible if `users:create` permission)
- [ ] Opens `mat-dialog` with form: email, firstName, lastName, temporaryPassword, role
- [ ] Email field required + email validation
- [ ] temporaryPassword field required
- [ ] Role field: `mat-select` with options "admin" and "user"
- [ ] On success: snackbar "User created successfully", table refreshes
- [ ] On error (duplicate email): shows error from backend response

### Edit user
- [ ] Click a table row to open detail/edit dialog
- [ ] Dialog shows current user info with editable fields: firstName, lastName, role
- [ ] Email is read-only (cannot be changed in Keycloak)
- [ ] "Save" button calls `PUT /api/users/:id`
- [ ] On success: snackbar "User updated successfully", table refreshes

### Delete user
- [ ] "Delete" button in the edit dialog (visible if `users:delete` permission)
- [ ] Opens confirmation dialog: "Are you sure? This will disable the user's account."
- [ ] On confirm: calls `DELETE /api/users/:id`
- [ ] On success: snackbar "User deleted successfully", dialog closes, table refreshes

### Unauthorized access
- [ ] `permissionGuard('users:read')` redirects to `/home` if user lacks permission
