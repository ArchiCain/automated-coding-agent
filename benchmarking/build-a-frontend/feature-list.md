# Benchmark Frontend — Feature List

## Purpose

This is a controlled test application for benchmarking THE Dev Team's autonomous agent pipeline. The app is deliberately scoped to be small enough to complete in a few hours but complex enough to exercise every part of the pipeline: implementation, sandbox deployment, self-testing, code review, and design review.

The backend API already exists (NestJS + Keycloak + PostgreSQL). The agents build only the Angular frontend.

---

## Features

### 1. Login Page (`/login`)

A simple authentication form that sends credentials to the backend. On success, the backend sets HTTP-only cookies — the frontend never touches tokens directly.

**Scope:**
- Email and password fields (Keycloak uses email as username)
- "Sign In" heading — no branding, no logos
- Error message display on failed login
- Redirect to `/home` on success
- Full-page centered card layout (no sidenav)

**API:**
- `POST /api/auth/login` — body: `{ username, password }` → response: `{ message, user: { id, username, email, roles, firstName, lastName } }` + sets HTTP-only cookies

**Acceptance criteria:**
- [ ] Dark background (#121212), card surface (#1e1e1e)
- [ ] mat-form-field with `appearance="outline"`, default border-radius (no custom border-radius)
- [ ] Sign In button clearly visible (contrasting against card)
- [ ] Error message appears below form on 401 response
- [ ] On success: stores user profile in memory (service/signal), redirects to /home
- [ ] Does NOT store tokens in localStorage — cookies are HTTP-only
- [ ] Page title: "Sign In"

---

### 2. Welcome Page (`/home`)

A static informational landing page that welcomes the user and explains what this application is and how to navigate it. Requires authentication.

**Scope:**
- Welcome message with logged-in user's first name (or username if no firstName)
- Brief explanation that this is a benchmark frontend application
- Feature cards describing what's available and where to find it:
  - **User Management** — "Manage users, roles, and permissions" (admin only, links to `/users`)
  - **Smoke Tests** — "Check backend service health status" (links to `/smoke-tests`)
- Each feature card has an icon, title, short description, and a link/button to navigate there
- If the user is not an admin, the User Management card should either be hidden or shown as "Admin access required" (grayed out)

**API:** None — this is a purely static/informational page using data already in the auth service.

**Acceptance criteria:**
- [ ] Shows "Welcome, {firstName}" using stored user data
- [ ] Brief intro paragraph explaining the application
- [ ] Feature cards in a responsive grid (2 columns desktop, 1 column mobile)
- [ ] Each card has a mat-icon, title, description, and navigation action
- [ ] User Management card is hidden or disabled for non-admins
- [ ] Clean layout with appropriate spacing
- [ ] Redirects to /login if session is invalid

---

### 3. User Management Page (`/users`)

A full CRUD interface for managing Keycloak users. Requires authentication + admin role.

**Scope:**
- Table with columns: Email, First Name, Last Name, Role, Status (enabled/disabled), Created
- Server-side pagination with page size selector
- Search input (server-side search across all fields)
- Column sorting (server-side)
- Click a row to open a detail/edit dialog
- "Create User" button opens a creation dialog
- Enable/disable toggle per user
- Delete user (with confirmation)
- Role badge with color coding (admin = blue, user = gray)

**API:**
- `GET /api/users` — paginated list with search/sort query params
- `GET /api/users/:id` — single user detail
- `POST /api/users` — create user (email, firstName, lastName, temporaryPassword, role)
- `PUT /api/users/:id` — update user (firstName, lastName, role)
- `DELETE /api/users/:id` — soft-delete (disable) user
- `PATCH /api/users/:id/enabled` — toggle enabled/disabled

**Acceptance criteria:**
- [ ] mat-table with server-side sorting on all columns
- [ ] mat-paginator with server-side pagination (page sizes: 5, 10, 25)
- [ ] mat-form-field search input triggers server-side search (debounced 300ms)
- [ ] "Create User" button opens mat-dialog with form (email, firstName, lastName, temporaryPassword, role)
- [ ] Row click opens mat-dialog with user details + edit form
- [ ] Edit dialog allows changing firstName, lastName, role
- [ ] Delete button in edit dialog with confirmation dialog
- [ ] Enable/disable toggle (mat-slide-toggle) in each row
- [ ] Role displayed as mat-chip with color coding
- [ ] "No users found" empty state when search matches nothing
- [ ] Loading spinner while fetching
- [ ] `permissionGuard('users:read')` redirects to /home if user lacks permission
- [ ] Snackbar feedback on create/update/delete success and errors

---

### 4. Smoke Tests Page (`/smoke-tests`)

A diagnostic page that shows the backend health status. Requires authentication.

**Scope:**
- Display the health check result (status, timestamp, service name)
- Manual "Check Now" button to re-trigger the health check
- Auto-refresh every 30 seconds
- Expandable to show more services as the backend adds them

**API:**
- `GET /api/health` — response: `{ status: 'ok' | string, timestamp: string, service: string }`

**Acceptance criteria:**
- [ ] Health result in a mat-card with service name, status, and timestamp
- [ ] Status indicator: green dot for "ok", red dot for anything else
- [ ] Timestamp displayed as relative time ("2 minutes ago") with exact time on hover
- [ ] "Check Now" button triggers fresh GET, shows loading state, refreshes display
- [ ] Auto-refresh every 30s with last-checked timestamp
- [ ] Responsive layout
- [ ] Clean, professional diagnostic look

---

---

## Cross-Cutting Requirements

These apply to ALL pages and should be established once in shared infrastructure, not repeated per feature.

### Authentication & Authorization
- Cookie-based — the browser sends HTTP-only cookies automatically
- `credentialsInterceptor` adds `withCredentials: true` to all requests globally
- On app bootstrap, `provideAuth()` calls `GET /api/auth/check` to verify session, load user profile, and load resolved permissions
- **Default protected:** `authGuard` on the parent route — all child routes inherit it. Only the login page is outside the protected parent.
- `permissionGuard(perm)` on routes requiring specific permissions (e.g. `permissionGuard('users:read')` on `/users`)
- Permission checks in templates via `authService.hasPermission$('perm')()` — for showing/hiding nav items, buttons, etc.
- Frontend permission checks are for **UX only** — the backend enforces via `@RequirePermission()` on every endpoint
- `authErrorInterceptor` handles 401 refresh with retry queue, 403 snackbar, 5xx snackbar

### Navigation
- Persistent side nav (mat-sidenav) on desktop, hamburger drawer on mobile
- Nav items: Welcome, Users (admin only), Smoke Tests
- Active route highlighted
- User info + theme toggle + logout button at bottom of sidenav

### API Layer
- Centralized `ApiService` or per-feature services using HttpClient
- Base URL from runtime config (`/config.json` → `{ apiUrl: string }`)
- All endpoints as typed methods
- `withCredentials: true` on all HTTP requests (required for cookie-based auth cross-origin)
- Error handling via HTTP interceptor

### Routing
```
/login          → LoginPage (public — outside protected parent)
/home           → HomePage (protected by parent authGuard)
/users          → UserManagementPage (protected + permissionGuard('users:read'))
/smoke-tests    → SmokeTestPage (protected by parent authGuard)
/               → redirect to /home
```

### Theming
- Support both light and dark themes via Angular Material theming
- Default to dark if no preference is stored
- Load theme preference from `GET /api/theme` on app bootstrap (after auth check)
- Apply theme via a CSS class on the root element (`theme-dark` / `theme-light`)
