# User Management — Test Plan

## Table

- [ ] `mat-table` displays columns: Email, First Name, Last Name, Role, Status, Created
- [ ] Server-side sorting via `matSort` + `(matSortChange)` on all columns
- [ ] Server-side pagination via `mat-paginator` (page sizes: 5, 10, 25)
- [ ] Loading spinner while fetching data
- [ ] "No users found" empty state when results are empty

## Search

- [ ] Search input above the table with `mat-form-field`
- [ ] Debounced 300ms server-side search
- [ ] Resets to page 1 when search changes
- [ ] Clearing search shows all users again

## Role Display

- [ ] Role displayed as `mat-chip`
- [ ] Admin role: blue (#42a5f5)
- [ ] User role: gray (#78909c)

## Status Toggle

- [ ] `mat-slide-toggle` in each row showing enabled/disabled
- [ ] Toggle calls `PATCH /api/users/:id/enabled` with `{ enabled: bool }`
- [ ] Snackbar feedback on success ("User enabled" / "User disabled")

## Create User

- [ ] "Create User" button visible only with `users:create` permission
- [ ] Dialog form: email (required + email validation), firstName, lastName, temporaryPassword (required), role (mat-select: admin/user)
- [ ] On success: snackbar "User created successfully", table refreshes
- [ ] On duplicate email: shows backend error message in dialog

## Edit User

- [ ] Click row opens detail/edit dialog
- [ ] Email shown as read-only
- [ ] Editable fields: firstName, lastName, role
- [ ] "Save" calls `PUT /api/users/:id`
- [ ] On success: snackbar "User updated successfully", table refreshes

## Delete User

- [ ] "Delete" button visible only with `users:delete` permission
- [ ] Confirmation dialog before deletion
- [ ] Calls `DELETE /api/users/:id` on confirm
- [ ] On success: snackbar "User deleted successfully", dialog closes, table refreshes

## Access Control

- [ ] `permissionGuard('users:read')` redirects to `/home` if user lacks permission
