# User Management — Flows

All flows assume the user has already signed in; `authGuard` passes because `AuthService.isAuthenticated()` is true or `GET /auth/check` revives the session (`features/keycloak-auth/guards/auth.guard.ts:7-24`). There is no permission guard on these routes (see `spec.md` Discrepancies).

## Flow 1: List load

1. User navigates to `/admin/users`.
2. Router lazy-loads `UsersPage` (`app.routes.ts:26-29`).
3. `UsersPage.ngOnInit` calls `loadUsers()` with `this.query = { page: 1, limit: 25 }` (`pages/users.page.ts:62-66`).
4. `UserManagementApiService.getUsers` builds `HttpParams` with `page=1` and `limit=25` and issues `GET ${backendUrl}/users?page=1&limit=25` with `withCredentials: true` (`services/user-management.api.ts:18-27`).
5. `authInterceptor` forwards; backend (global `KeycloakJwtGuard`) validates the cookie and the controller returns `{ users: [...], pagination: { page, pageSize, total, totalPages } }`.
6. The FE reads `response.users` and calls `this.users.set(response.users)` (`pages/users.page.ts:99-103`). `response.pagination` is ignored.
7. `UsersTableComponent` renders rows via `mat-table`.

Note: the FE sends `limit=25` but the backend query DTO uses `pageSize` — the backend silently defaults to `pageSize=10`, so only 10 rows come back.

## Flow 2: Search

1. User types in the search input (`pages/users.page.ts:29-33`).
2. Each `input` event fires `onSearch` (no debounce), setting `query = { ...query, search: value, page: 1 }` (`pages/users.page.ts:68-72`).
3. `loadUsers()` -> `GET /users?page=1&limit=25&search=<value>`.
4. Table re-renders with the returned page.

## Flow 3: Sort

1. User clicks a sortable header (`username`, `email`, or `createdAt`).
2. `MatSort` emits a `Sort` event `{ active, direction }` (`components/users-table/users-table.component.html:1`).
3. `onSort` sets `query = { ...query, sortBy: sort.active, sortOrder: sort.direction || 'asc' }` (`pages/users.page.ts:74-77`). Current `page` is preserved.
4. `loadUsers()` -> `GET /users?page=<current>&limit=25&sortBy=...&sortOrder=asc|desc`.
5. Note: the backend query DTO expects `sortDirection`, not `sortOrder`, so the server silently uses the default `sortDirection='asc'`.

## Flow 4: Create user

1. User clicks "New User" button on `UsersPage` -> `router.navigate(['/admin/users/new'])` (`pages/users.page.ts:23-26`).
2. Router lazy-loads `UserPage`; `route.snapshot.params['id']` is undefined, so `isEditMode` is false (`pages/user.page.ts:39-41`).
3. `UserFormComponent.ngOnInit` adds `Validators.required, minLength(8)` to `password` and renders the password field (`components/user-form/user-form.component.ts:51-54`, `user-form.component.html:12-17`).
4. User fills `username` (>=3 chars), `email` (valid email), `password` (>=8 chars), optional `firstName`/`lastName`, selects one or more `roles` (default `['user']`).
5. User clicks "Create". `onSubmit` checks `form.valid`, then emits `form.getRawValue()` as `CreateUserRequest` (`user-form.component.ts:57-61`).
6. `UserPage.onSubmit` calls `userApi.createUser(data)` -> `POST ${backendUrl}/users` with the emitted body (`pages/user.page.ts:50-60`, `services/user-management.api.ts:33-35`).
7. On success, `router.navigate(['/admin/users'])`. No snackbar. On error, the subscription has no error handler (request fails silently in the UI; error lands in the dev console).

Note: the request body does NOT match backend `CreateUserDto` (missing `temporaryPassword`, `role`; extra `username`, `password`, `roles[]`). In practice the backend will reject or mis-handle it.

## Flow 5: Edit user

1. User clicks the edit icon on a row in `UsersTableComponent` -> emits `editUser` (`users-table.component.html:29-31`).
2. `UsersPage.onEdit` calls `router.navigate(['/admin/users', user.id])` (`pages/users.page.ts:79-81`).
3. `UserPage.ngOnInit` reads `:id`, calls `userApi.getUser(id)` -> `GET ${backendUrl}/users/:id` (`pages/user.page.ts:43-47`, `services/user-management.api.ts:29-31`).
4. When the response arrives `this.user.set(user)`; `UserFormComponent` receives the user via the `user` input.
5. `UserFormComponent.ngOnInit` patches the form, disables `username`, clears `password` validators, and the password field is not rendered (`user-form.component.ts:39-55`, `user-form.component.html:12-17`).
6. User edits `firstName`, `lastName`, and/or `roles`.
7. User clicks "Update". `form.getRawValue()` is emitted as `UpdateUserRequest` (`user-form.component.ts:57-61`).
8. `UserPage.onSubmit` calls `userApi.updateUser(id, data)` -> `PUT ${backendUrl}/users/:id` (`pages/user.page.ts:52-55`, `services/user-management.api.ts:37-39`).
9. On success, `router.navigate(['/admin/users'])`. No snackbar, no error handling.

Note: backend reads singular `dto.role`, not the `roles: string[]` the form sends. Role changes from this UI are silently discarded by the backend.

## Flow 6: Delete user

1. User clicks the warn-colored delete icon on a row -> emits `deleteUser` (`users-table.component.html:32-34`).
2. `UsersPage.onDelete` opens `ConfirmationModalComponent` with `{ title: 'Delete User', message: 'Are you sure you want to delete "{username}"?', confirmText: 'Delete' }` (`pages/users.page.ts:83-90`).
3. `ref.afterClosed().subscribe(confirmed => ...)` (`pages/users.page.ts:92-96`).
4. If `confirmed === true`: `userApi.deleteUser(user.id)` -> `DELETE ${backendUrl}/users/:id`. Backend responds `{ message: 'User deleted successfully' }` after disabling (not removing) the user.
5. On success: `loadUsers()` re-fires the current query. No snackbar.
6. If `confirmed` is falsy: no API call; dialog closes.

## Flow 7: Cancel form

1. On the Create or Edit screen the user clicks "Cancel".
2. `UserFormComponent` emits `cancelForm` (`user-form.component.html:39`, `user-form.component.ts:22`).
3. `UserPage` passes `(cancelForm)="router.navigate(['/admin/users'])"` in its template, so the router navigates back to the list (`pages/user.page.ts:21`). No confirmation prompt; unsaved edits are discarded.

## Flow 8: Unauthenticated access

1. Unauthenticated user navigates to `/admin/users`.
2. `authGuard` sees `AuthService.isAuthenticated()` is false, calls `GET /auth/check`; the session cookie is missing so the check fails.
3. Guard returns a `UrlTree` to `/login` (`features/keycloak-auth/guards/auth.guard.ts`).
4. The user never reaches `UsersPage`.

There is no equivalent flow for "authenticated but unauthorized" because no permission guard runs on these routes.
