# User Management Page — Flows

## Flow 1: View Users (Initial Load)

1. Admin navigates to `/users`
2. `permissionGuard('users:read')` passes
3. Page loads, shows loading spinner
4. `GET /api/users?page=1&pageSize=10&sortBy=username&sortDirection=asc` is called
5. Table renders with first page of users
6. `mat-paginator` shows total count (e.g. "1-10 of 42")
7. Each row shows: email, firstName, lastName, role chip, enabled toggle, created date

## Flow 2: Search Users

1. Admin types "jane" in the search field
2. After 300ms debounce, `GET /api/users?page=1&pageSize=10&search=jane` is called
3. Table updates with filtered results
4. Paginator resets to page 1
5. Admin clears search → table shows all users again

## Flow 3: Sort Users

1. Admin clicks the "Email" column header
2. Sort indicator appears (ascending arrow)
3. `GET /api/users?page=1&pageSize=10&sortBy=email&sortDirection=asc` is called
4. Table re-renders with sorted results
5. Admin clicks "Email" again → sort flips to descending
6. `GET /api/users?page=1&pageSize=10&sortBy=email&sortDirection=desc` is called

## Flow 4: Paginate

1. Admin clicks "next page" on paginator
2. `GET /api/users?page=2&pageSize=10` is called
3. Table updates with page 2 results
4. Admin changes page size to 25
5. `GET /api/users?page=1&pageSize=25` is called (resets to page 1)

## Flow 5: Create User — Happy Path

1. Admin clicks "Create User" button
2. CreateUserDialog opens
3. Admin fills in:
   - Email: `newuser@example.com`
   - First Name: `New`
   - Last Name: `User`
   - Temporary Password: `temppass123`
   - Role: `user`
4. Admin clicks "Create"
5. `POST /api/users` with `{ email: "newuser@example.com", firstName: "New", lastName: "User", temporaryPassword: "temppass123", role: "user" }`
6. Backend returns 201 with the new UserDto
7. Dialog closes
8. Snackbar: "User created successfully"
9. Table refreshes (re-fetches current page)

## Flow 6: Create User — Duplicate Email

1. Admin opens CreateUserDialog
2. Admin enters email that already exists: `admin@example.com`
3. Admin fills other fields and clicks "Create"
4. Backend returns 400 `{ statusCode: 400, message: "User with this email already exists" }`
5. Error message displayed in dialog below the form
6. Dialog stays open, user can fix and retry

## Flow 7: Edit User

1. Admin clicks a row in the table (e.g. "jane@example.com")
2. UserDetailDialog opens with current data pre-filled
3. Email shown as read-only text
4. Admin changes lastName from "Doe" to "Smith"
5. Admin changes role from "user" to "admin"
6. Admin clicks "Save"
7. `PUT /api/users/{jane-id}` with `{ lastName: "Smith", role: "admin" }`
8. Backend returns 200 with updated UserDto
9. Dialog closes
10. Snackbar: "User updated successfully"
11. Table refreshes

## Flow 8: Delete User

1. Admin opens UserDetailDialog for a user
2. Admin clicks "Delete" button (bottom-left of dialog)
3. ConfirmDialog opens: "Confirm Delete" / "Are you sure you want to delete this user? This will disable their account."
4. Admin clicks "Delete" in confirmation
5. `DELETE /api/users/{user-id}` is called
6. Backend returns 200 `{ message: "User deleted successfully" }`
7. Both dialogs close
8. Snackbar: "User deleted successfully"
9. Table refreshes

## Flow 9: Delete User — Cancel

1. Admin opens UserDetailDialog, clicks "Delete"
2. ConfirmDialog opens
3. Admin clicks "Cancel"
4. ConfirmDialog closes, UserDetailDialog remains open
5. No API call is made

## Flow 10: Enable/Disable Toggle

1. Admin sees a user with enabled=true (toggle is ON)
2. Admin clicks the toggle
3. `PATCH /api/users/{user-id}/enabled` with `{ enabled: false }`
4. Backend returns 200 with updated UserDto
5. Toggle reflects new state (OFF)
6. Snackbar: "User disabled"
7. Admin clicks toggle again → `{ enabled: true }` → "User enabled"

## Flow 11: Empty State

1. Admin types a search term that matches no users (e.g. "zzzzznonexistent")
2. Table shows "No users found" message centered in the table area
3. Paginator shows "0 of 0"

## Flow 12: Unauthorized Access

1. Regular user (without `users:read`) tries to navigate to `/users`
2. `permissionGuard('users:read')` fails
3. User is redirected to `/home`
4. User never sees the users page
