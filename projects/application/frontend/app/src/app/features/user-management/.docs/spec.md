# User Management — Spec

## What it is

Admin pages at `/admin/users` and `/admin/users/:id` for listing, viewing, creating, editing, and deleting Keycloak users. The list page shows a searchable, sortable table of users with per-row edit and delete actions; the detail page hosts a single form that doubles as a "create user" screen at `/admin/users/new` and an "edit user" screen at `/admin/users/:id`. Delete is soft on the backend — the user account is disabled rather than removed.

## How it behaves

### Opening the list

When the user opens `/admin/users`, the page immediately asks the server for the first 25 users and renders them in a table with columns for username, email, roles, created-at date, and a row-actions cell. There is no loading spinner and no empty-state message — the table simply renders whatever comes back. The total user count is fetched but never shown.

### Searching

A search field sits above the table. Every keystroke fires a fresh list request with the current text and resets to page 1. There is no debounce — each character typed is a separate request.

### Sorting

Clicking a column header on username, email, or created-at toggles ascending/descending and re-fetches the list. An empty direction is treated as ascending. Sorting keeps the user on whatever page they were on rather than jumping back to page 1. Roles and the actions column are not sortable.

### Paging

There is none. Page size is fixed at 25, no paginator control is rendered, and there is no way to move past the first page from the UI.

### Row display

Each user row shows the username, email, each role rendered as a chip (all chips look identical — no color difference between admin and user), the created-at date formatted via Angular's short date pipe, and two icon buttons: edit and delete. The delete button is styled in the warn color.

### Opening a user

Clicking the edit icon navigates to `/admin/users/:id`. The detail page fetches that user and pre-fills the form. The title reads "Edit User". The username field is shown but disabled so the user cannot change it. The password field is hidden entirely and its validators are cleared.

### Creating a user

Navigating to `/admin/users/new` opens the same detail page with an empty form and the title "Create User". Username is editable and required with a 3-character minimum; email is required and validated as an email; password is shown, required, with an 8-character minimum; first name and last name are free-text; roles is a multi-select listing `admin`, `user`, and `viewer`, required, defaulting to `['user']`. Submit is disabled while the form is invalid; the button is labeled "Create" in this mode. On success the page navigates back to `/admin/users`. No snackbar or toast is shown.

### Editing a user

In edit mode the submit button is labeled "Update" and submitting issues a PUT to the user's id, then navigates back to the list. Cancel navigates back without saving. No snackbar or toast on success or failure.

### Deleting a user

Clicking the delete icon on a row opens a generic confirmation dialog asking "Are you sure you want to delete \"{username}\"?" with a "Delete" confirm button. Confirming calls DELETE on the user id and re-runs the current list query. The dialog does not mention that the account is merely disabled rather than truly removed.

### Access

All three routes sit under the authenticated layout. The only check run before the page loads is that the user is signed in. Any signed-in user — including one with only the plain `user` role — can reach the list, open any user, create, edit, and delete. The "Admin > Users" nav link is always visible.

## Acceptance criteria

- Opening `/admin/users` fires `GET /users?page=1&limit=25` and renders the result in a table.
- Columns render in order: username, email, roles, created-at, actions.
- Sort arrows appear only on username, email, and created-at.
- Role cells render each role as an identical-looking chip; there is no color variant per role.
- Created-at renders with the Angular `date:'short'` pipe.
- Typing in search fires a new list request on every keystroke with `page=1` and no debounce.
- Sorting a column re-fetches with `sortBy` and `sortOrder` and keeps the current page (does not reset to page 1).
- No paginator is rendered and page size is fixed at 25.
- No loading spinner, empty state, or total-count display is rendered.
- The edit icon navigates to `/admin/users/:id`.
- The delete icon (warn-colored) opens a confirmation dialog; confirming fires `DELETE /users/:id` then re-runs the current list query.
- `/admin/users/new` shows title "Create User", an empty form, and a visible password field.
- `/admin/users/:id` fetches the user, patches the form, disables username, and hides the password field.
- Roles is a multi-select with options `admin`, `user`, `viewer`, required, defaulting to `['user']`.
- Submit is disabled while the form is invalid; label is "Create" or "Update" based on mode.
- Create success fires `POST /users` then navigates to `/admin/users` with no snackbar.
- Update success fires `PUT /users/:id` then navigates to `/admin/users` with no snackbar.
- Cancel on the form navigates back to `/admin/users` without saving.
- Any authenticated user can reach all three routes; no permission check is enforced on the FE or the BE.

## Known gaps

- There is no permission guard on any of the three routes; only `authGuard` runs, so any signed-in user reaches these pages regardless of role. Prior docs claimed `permissionGuard('users:read')` would redirect non-admins. `src/app/app.routes.ts:26-39`, `features/keycloak-auth/guards/auth.guard.ts:7-24`.
- The nav item carries a `permission: 'users:read'` marker but the tree renderer ignores it, so the link is always visible. `features/navigation-config/navigation-config.ts:27`.
- `RequirePermissionDirective` is not used inside this feature's templates; Create, Edit, and Delete controls render unconditionally.
- The backend enforces only `KeycloakJwtGuard` — its `@RequirePermission('users:*')` metadata is inert — so the full chain is unguarded end-to-end. `backend/app/src/features/user-management/.docs/spec.md` Discrepancies.
- The create form sends `{ username, password, roles: string[] }` but the backend expects `{ email, temporaryPassword, role: 'admin'|'user' }`; required backend fields are never sent, so user creation through this UI cannot succeed. `components/user-form/user-form.component.ts:26-61`, `backend/.../user-management/.docs/contracts.md`.
- Edit also sends `roles: string[]` where the backend reads `dto.role` (singular), so role changes from this UI are silently dropped. `components/user-form/user-form.component.ts:57-61`, `backend/.../user-management.service.ts:325`.
- The list query uses `limit` and `sortOrder` but the backend expects `pageSize` and `sortDirection`, so the backend ignores them and defaults to `pageSize=10`, `sortDirection='asc'`. Sorting from the UI does nothing server-side, and the list always returns 10 rows regardless of the hard-coded `limit: 25`. `services/user-management.api.ts:14-44`, `backend/.../contracts.md`.
- The list response envelope drifts: the FE type reads `total`, `page`, `limit` from the top level, while the backend returns `pagination.{total,page,pageSize,...}`. `types.ts:1-42`, `backend/.../contracts.md`.
- The user DTO drifts: the FE `User` has `createdAt: string` and `updatedAt: string`, while the backend returns `createdTimestamp: number` and no `updatedAt`. `types.ts:1-10`, `backend/.../user-management.types.ts`.
- The form lists `viewer` as a role choice, but Keycloak only seeds `admin` and `user`; selecting `viewer` sends a role the backend cannot assign. `components/user-form/user-form.component.ts:24`, `projects/application/keycloak/.docs/spec.md`.
- The FE `Permission` union uses `users:write`, while the backend declares `users:create` and `users:update`; the two vocabularies do not overlap. `features/keycloak-auth/permissions/permissions.types.ts:1-9`, `backend/.../contracts.md`.
- Prior docs described a dialog-based Create/Edit/Delete flow with a paginator, page-size selector, 300ms search debounce, enable/disable slide toggle, snackbars, role chip colors, empty state, and loading spinner; the current code is page-based and none of those controls exist.
- The delete confirmation copy does not mention that the account is merely disabled rather than actually removed. `pages/users.page.ts:83-97`, `backend/.../user-management.service.ts:354-356`.

## Code map

Paths are relative to `projects/application/frontend/app/`.

| Concern | File · lines |
|---|---|
| Routes mounted under authenticated layout, no permission guard | `src/app/app.routes.ts:26-39` |
| List page: init fetch, search, sort, delete flow | `src/app/features/user-management/pages/users.page.ts:56-104` |
| List page: initial `{ page: 1, limit: 25 }` fetch on init | `src/app/features/user-management/pages/users.page.ts:62-66` |
| Search handler: no debounce, resets to page 1 | `src/app/features/user-management/pages/users.page.ts:29-33,68-72` |
| Sort handler: keeps current page, `'asc'` fallback | `src/app/features/user-management/pages/users.page.ts:74-77` |
| Delete flow: confirmation dialog + re-fetch | `src/app/features/user-management/pages/users.page.ts:79-97` |
| Table columns, sort headers, role chips, action buttons | `src/app/features/user-management/components/users-table/users-table.component.ts:11-25`, `.../users-table.component.html:1-35` |
| Detail page: create vs edit mode, prefetch, submit/cancel | `src/app/features/user-management/pages/user.page.ts:14,21,32-62` |
| Form fields, validators, edit-mode username disable, password toggle | `src/app/features/user-management/components/user-form/user-form.component.ts:17-62`, `.../user-form.component.html:12-42` |
| Roles multi-select options and default | `src/app/features/user-management/components/user-form/user-form.component.ts:24,32` |
| HTTP client for `/users` CRUD | `src/app/features/user-management/services/user-management.api.ts:9-44` |
| Frontend DTO types (drift from backend) | `src/app/features/user-management/types.ts:1-42` |
| Nav item metadata (ignored by renderer) | `src/app/features/navigation-config/navigation-config.ts:27` |
| Auth guard (only gate on the routes) | `src/app/features/keycloak-auth/guards/auth.guard.ts:7-24` |
| FE Permission union | `src/app/features/keycloak-auth/permissions/permissions.types.ts:1-9` |
| Module (thin re-export wrapper) | `src/app/features/user-management/user-management.module.ts:7-11` |

### Backend contract

Shapes and endpoints served by the `user-management` backend feature; see `projects/application/backend/app/src/features/user-management/.docs/spec.md` and `contracts.md`.
