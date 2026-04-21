# User Management — Test Plan

Targets current code only — does not assume fixes for the discrepancies in `spec.md` / `contracts.md`. Use `test-data.md` for seed accounts.

## Access control

- [ ] Unauthenticated navigation to `/admin/users` -> redirected to `/login` by `authGuard` (`features/keycloak-auth/guards/auth.guard.ts`).
- [ ] Authenticated `testuser` (realm role `user` only) reaches `/admin/users` and the list renders — **no permission redirect happens** (`app.routes.ts:26-29`, no `permissionGuard`).
- [ ] Admin nav item "Admin > Users" is visible to every authenticated user regardless of role (`navigation-config.ts:22-29`).

## List page (`UsersPage`)

- [ ] On load, FE issues `GET /users?page=1&limit=25` (`pages/users.page.ts:62-66`, `services/user-management.api.ts:18-27`).
- [ ] `mat-table` renders columns `username`, `email`, `roles`, `createdAt`, `actions` in that order (`components/users-table/users-table.component.ts:24`, `users-table.component.html`).
- [ ] Sort headers present on `username`, `email`, `createdAt`; `roles` and `actions` are not sortable (`users-table.component.html:3,8,22`).
- [ ] Each role renders as a plain `mat-chip` (no admin/user color variants).
- [ ] `createdAt` cell shows a short date string via `date:'short'` pipe.
- [ ] No paginator, no page-size selector, no loading spinner, no empty state are rendered (absence tests).
- [ ] No `mat-slide-toggle` for enabled/disabled is rendered in any row (absence test).

## Search

- [ ] Typing any character in the search field fires `GET /users?search=<value>&page=1&limit=25` **immediately** (no debounce) (`pages/users.page.ts:68-72`).
- [ ] Changing the search text resets `page` to 1.
- [ ] Clearing the search to empty fires `GET /users?search=&page=1&limit=25`.

## Sort

- [ ] Clicking the Username header once emits `Sort { active: 'username', direction: 'asc' }` and fires `GET /users?...&sortBy=username&sortOrder=asc` (`pages/users.page.ts:74-77`).
- [ ] Clicking again toggles to `desc`; clicking a third time (direction `''`) sends `sortOrder=asc` due to the `|| 'asc'` fallback.
- [ ] Sort does NOT reset `page` to 1 (contrast with search) — verify `page` is whatever was last set.

## Delete

- [ ] Clicking the warn-colored delete icon opens `ConfirmationModalComponent` with title `Delete User`, message `Are you sure you want to delete "<username>"?`, confirm label `Delete` (`pages/users.page.ts:83-90`).
- [ ] Confirm fires `DELETE /users/:id` with `withCredentials` and, on success, re-fires the current list query (`pages/users.page.ts:92-96`).
- [ ] Cancel closes the dialog without any API call.
- [ ] No snackbar or toast is shown on success or failure.

## Create user (`/admin/users/new`)

- [ ] Title reads "Create User" when `:id` is absent (`pages/user.page.ts:14,39-41`).
- [ ] `password` field is visible and required with `minLength(8)` (`user-form.component.ts:51-54`, `user-form.component.html:12-17`).
- [ ] `username` field is required with `minLength(3)` and enabled.
- [ ] `email` field is required with `Validators.email`.
- [ ] `roles` is a `mat-select multiple` defaulting to `['user']` with options `admin`, `user`, `viewer` (`user-form.component.ts:24,32`).
- [ ] Submit button is disabled while `form.invalid` and labeled `Create`.
- [ ] On submit FE issues `POST /users` with `{ username, email, password, firstName, lastName, roles }` (`pages/user.page.ts:56-60`).
- [ ] On success the app navigates to `/admin/users` (no snackbar).
- [ ] Cancel button navigates to `/admin/users` without confirmation, discarding edits.

## Edit user (`/admin/users/:id`)

- [ ] Title reads "Edit User" when `:id` is present (`pages/user.page.ts:14,39-41`).
- [ ] On init FE issues `GET /users/:id` and patches the form with the response (`pages/user.page.ts:43-47`).
- [ ] `username` field is disabled in edit mode (`user-form.component.ts:49`).
- [ ] Password field is NOT rendered; its validators are cleared (`user-form.component.ts:50`, `user-form.component.html:12-17`).
- [ ] Submit button label is `Update`.
- [ ] On submit FE issues `PUT /users/:id` with `{ email, firstName, lastName, roles }` and then navigates to `/admin/users` (`pages/user.page.ts:52-55`, `services/user-management.api.ts:37-39`).

## Known-broken end-to-end behaviors (document, don't assert passing)

- [ ] Creating a user via the FE form fails on the backend because the request is missing `temporaryPassword` and `role` and contains extra fields (`spec.md` Discrepancies).
- [ ] Editing `roles` through the form has no effect on the backend (backend reads singular `role`).
- [ ] Only 10 users are ever returned regardless of the FE's `limit=25` (backend expects `pageSize`).
- [ ] Server-side sort is always ascending regardless of what the FE sends (backend expects `sortDirection`, FE sends `sortOrder`).
