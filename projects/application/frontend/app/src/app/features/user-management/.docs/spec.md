# User Management — Spec

## Purpose

Admin UI for managing Keycloak users. Provides a searchable, sortable list page and a create/edit page for user records. Delete is soft — the backend disables the user rather than removing them (`projects/application/backend/app/src/features/user-management/.docs/spec.md` behavior). All CRUD goes through `UserManagementApiService` against `${backendUrl}/users` (`services/user-management.api.ts:14-44`).

## Behavior

- Mounts three routes under the authenticated layout (`src/app/app.routes.ts:26-39`):
  - `/admin/users` -> `UsersPage` (`pages/users.page.ts:56`)
  - `/admin/users/new` -> `UserPage` in create mode (`pages/user.page.ts:32`)
  - `/admin/users/:id` -> `UserPage` in edit mode (`pages/user.page.ts:39-46`)
- On `UsersPage.ngOnInit` fetches the first page with `{ page: 1, limit: 25 }` (`pages/users.page.ts:62-66`). There is no loading spinner and no empty-state UI in the template.
- Search field above the table calls `GET /users?search=...&page=1&limit=25` on every `input` event — **no debounce** (`pages/users.page.ts:29-33`, `:68-72`).
- Sort: clicking a `mat-sort-header` column emits `Sort` to the parent, which sets `sortBy` and `sortOrder` (falling back to `'asc'` when direction is empty) and re-fetches (`pages/users.page.ts:74-77`, `components/users-table/users-table.component.html:1-5`). The new query keeps the current page — it does NOT reset to page 1 on sort change (contrast with search, which does).
- Table columns rendered in order: `username`, `email`, `roles`, `createdAt`, `actions` (`components/users-table/users-table.component.ts:24`). Sort headers are on `username`, `email`, and `createdAt` only (`users-table.component.html:3,8,22`). `createdAt` is rendered with the Angular `date:'short'` pipe (`users-table.component.html:23`).
- Role cells render each role as a `mat-chip` with no color variants — admin and user chips look identical (`users-table.component.html:14-18`).
- Row actions: an edit button navigates to `/admin/users/:id`, and a `color="warn"` delete button opens a confirmation dialog (`pages/users.page.ts:79-97`, `users-table.component.html:28-35`).
- Delete flow: `ConfirmationModalComponent` from `@features/shared` asks "Are you sure you want to delete \"{username}\"?" with confirm label "Delete"; on confirm calls `DELETE /users/:id` and re-fetches the current query (`pages/users.page.ts:83-97`).
- `UserPage` title toggles between "Create User" and "Edit User" based on the presence of the `:id` route param (`pages/user.page.ts:14`, `:39-41`). In edit mode it fetches the user via `GET /users/:id` and passes the result into the form (`pages/user.page.ts:43-47`).
- `UserFormComponent` uses a reactive `FormGroup` with fields `username`, `email`, `password`, `firstName`, `lastName`, and `roles` (`components/user-form/user-form.component.ts:26-33`):
  - `username`: required, `minLength(3)`. Disabled when editing (`user-form.component.ts:49`).
  - `email`: required + `Validators.email`.
  - `password`: required + `minLength(8)` in create mode; validators cleared in edit mode and the field is not rendered (`user-form.component.ts:50-54`, `user-form.component.html:12-17`).
  - `roles`: required, `mat-select multiple`, default `['user']`, choices `['admin', 'user', 'viewer']` (`user-form.component.ts:24,32`, `user-form.component.html:29-36`).
  - Submit emits `form.getRawValue()` (includes disabled `username`) cast to `CreateUserRequest | UpdateUserRequest` (`user-form.component.ts:57-61`). Cancel navigates back to `/admin/users` (`pages/user.page.ts:21`).
- On form submit, `UserPage.onSubmit` calls `POST /users` (create) or `PUT /users/:id` (edit) and navigates back to `/admin/users` on success; no snackbar, no error handling (`pages/user.page.ts:50-61`).
- Pagination: none. There is no `mat-paginator` in the template, page size is hard-coded to 25, and the "next page" / page-size controls described in prior docs are absent. Total count from the backend is fetched but never rendered.

## Authentication and Authorization — actual behavior

- `/admin/users`, `/admin/users/new`, `/admin/users/:id` are children of the authenticated layout whose only guard is `authGuard` (`src/app/app.routes.ts:11-46`, `features/keycloak-auth/guards/auth.guard.ts:7-24`). **No `permissionGuard` is attached to any of these routes.**
- `Admin > Users` nav item carries `permission: 'users:read'` metadata (`features/navigation-config/navigation-config.ts:27`), but the `NavigationTreeComponent` does not read it and the router does not enforce it. The link is always visible and reachable for any authenticated user.
- `RequirePermissionDirective` is not used inside this feature's templates — Create User, Edit User, and Delete buttons are rendered unconditionally.
- Backend enforces only `KeycloakJwtGuard`; its `@RequirePermission('users:*')` metadata is inert (`backend/app/src/features/user-management/.docs/spec.md` Discrepancies). The full chain: any authenticated user (including `testuser` with only the `user` role) can list, create, edit, and soft-delete users end-to-end.

## Components / Services

| Part | Purpose | Source |
|---|---|---|
| `UserManagementModule` | Thin NgModule re-exporting standalone components | `user-management.module.ts:7-11` |
| `UsersPage` | List page: search, sort, row actions, delete confirmation | `pages/users.page.ts:56-104` |
| `UserPage` | Create/edit page; hosts `UserFormComponent` inside a `mat-card` | `pages/user.page.ts:32-62` |
| `UsersTableComponent` | `mat-table` with sort headers, role chips, edit/delete icon buttons | `components/users-table/users-table.component.ts:11-25` |
| `UserFormComponent` | Reactive form; toggles password + disables username in edit mode | `components/user-form/user-form.component.ts:17-62` |
| `UserManagementApiService` | HTTP client for `/users` CRUD | `services/user-management.api.ts:9-44` |
| `User`, `CreateUserRequest`, `UpdateUserRequest`, `UserListQuery`, `UserListResponse` | Frontend DTO types | `types.ts:1-42` |

## Acceptance Criteria

- [ ] `/admin/users` renders `UsersPage` under the authenticated layout and `GET /users?page=1&limit=25` fires on init (`pages/users.page.ts:62-66`).
- [ ] Table shows columns `username`, `email`, `roles`, `createdAt`, `actions` in that order; sort arrows on `username`, `email`, `createdAt` only (`users-table.component.ts:24`, `users-table.component.html`).
- [ ] Typing in the search field fires `GET /users?search=...&page=1&limit=25` immediately (no debounce) (`pages/users.page.ts:68-72`).
- [ ] Sorting a column fires `GET /users?sortBy=...&sortOrder=asc|desc` and keeps the current page (`pages/users.page.ts:74-77`).
- [ ] Clicking the edit icon navigates to `/admin/users/:id`; clicking the warn-colored delete icon opens `ConfirmationModalComponent` and, on confirm, calls `DELETE /users/:id` then re-queries the list (`pages/users.page.ts:79-97`).
- [ ] `/admin/users/new` renders `UserPage` with title "Create User" and an empty form; password field is visible, required, min-length 8 (`user-form.component.ts:51-54`, `user-form.component.html:12-17`).
- [ ] `/admin/users/:id` prefetches via `GET /users/:id`, patches the form, disables `username`, hides and clears password validators (`pages/user.page.ts:43-47`, `user-form.component.ts:39-55`).
- [ ] Roles field is a `multiple` `mat-select` with options `admin`, `user`, `viewer`, default `['user']`, required (`user-form.component.ts:24,32`).
- [ ] Submit button is disabled while `form.invalid` and labeled "Create" or "Update" accordingly (`user-form.component.html:40-42`).
- [ ] On create success: `POST /users` then `router.navigate(['/admin/users'])` (no snackbar) (`pages/user.page.ts:56-60`).
- [ ] On update success: `PUT /users/:id` then `router.navigate(['/admin/users'])` (no snackbar) (`pages/user.page.ts:52-55`).
- [ ] Any authenticated user can reach all three routes and all API calls succeed — permission checks are not enforced on the FE or BE.

## Discrepancies — intent vs. reality

- **No permission enforcement anywhere in the path.** Prior docs (`spec.md` L4, L61; `flows.md` L6, L117; `test-plan.md` L54) claimed `permissionGuard('users:read')` redirects non-admins. The current routes file has no `permissionGuard` on `admin/users*` (`src/app/app.routes.ts:26-39`), and the backend's `@RequirePermission` metadata is inert. The nav item's `permission: 'users:read'` marker is metadata the renderer ignores.
- **Permission vocabulary mismatch.** FE defines `Permission = 'users:read' | 'users:write' | 'users:delete' | ...` (`features/keycloak-auth/permissions/permissions.types.ts:1-9`). Backend controllers declare `users:read|create|update|delete` (`backend/app/src/features/user-management/.docs/contracts.md`). The FE has no `users:create` or `users:update` strings to check against. Today nothing enforces either vocabulary — the divergence would matter only if guards are wired up.
- **FE `types.ts` is out of sync with the backend DTOs.** FE `User` has `createdAt: string`, `updatedAt: string`, `roles: string[]` (`types.ts:1-10`), backend `UserDto` returns `createdTimestamp: number`, no `updatedAt`, `roles: ('admin'|'user')[]` (`backend/.../user-management.types.ts`). FE `CreateUserRequest` fields `{ username, email, password, roles }` do not match backend `{ email, firstName, lastName, temporaryPassword, role }`. FE `UserListQuery` uses `page|limit|sortBy|sortOrder`; backend expects `page|pageSize|sortBy|sortDirection`. Calls compile (Angular HTTP is untyped at runtime) but **the backend will ignore `limit`/`sortOrder`** and default to `pageSize=10`, `sortDirection='asc'`. Sorting from the UI therefore does nothing server-side, and the list always returns 10 rows regardless of the hard-coded `limit: 25`.
- **Form shape does not match backend.** `UserFormComponent` emits `{ username, email, password, firstName, lastName, roles: string[] }` (`user-form.component.ts:26-61`). Backend `POST /users` expects `{ email, firstName, lastName, temporaryPassword, role: 'admin'|'user' }`. `username` and `password` are ignored; `roles` (array) is ignored — backend reads `dto.role` (singular). In practice user creation through this form cannot succeed: the required `temporaryPassword` and `role` fields are never sent.
- **Edit mode sends `roles: string[]` in PUT body.** Backend reads `dto.role` (singular `'admin'|'user'`) (`backend/.../user-management.service.ts:325`). Role changes from this UI are silently dropped.
- **"viewer" role option is fictional.** `availableRoles = ['admin', 'user', 'viewer']` (`user-form.component.ts:24`) but Keycloak only seeds `admin` and `user` (`projects/application/keycloak/.docs/spec.md` seeded roles). Selecting `viewer` would send a role the backend cannot assign.
- **Page-size and sort controls are described by prior docs but not present.** Prior `spec.md`/`flows.md` reference `mat-paginator`, page sizes 5/10/25, 300ms search debounce, enable/disable `mat-slide-toggle`, snackbars, role chip colors, empty state, loading spinner, and dedicated Create/Edit/Delete dialogs — none of these exist in current source.
- **Delete confirmation copy.** Uses the generic `ConfirmationModalComponent` with message "Are you sure you want to delete \"{username}\"?" — it does NOT mention that the account is merely disabled, which the backend's actual behavior is (`backend/.../user-management.service.ts:354-356`).
