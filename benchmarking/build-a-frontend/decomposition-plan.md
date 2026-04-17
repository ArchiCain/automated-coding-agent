# Benchmark Frontend — Decomposition Plan

How the Team Lead should decompose this into tickets. Order matters — dependencies are explicit.

---

## Phase 1: Foundation (no dependencies)

These tickets have zero dependencies and can all run in parallel.

### Ticket 1: Project scaffolding + global styles + theming
- **Role:** frontend-developer
- **Scope:** Create the Angular project, set up `styles.scss` with both dark and light Material themes, configure `app.config.ts` with providers, create `app.routes.ts` skeleton, create `config.json`, set up `AppConfigService`, set up `ThemeService` (GET/PUT `/api/theme`, applies class to `<body>`). Note: `provideAuth()` wiring happens in Ticket 2 — this ticket sets up the app shell that auth plugs into.
- **Acceptance:** `ng serve` works, dark background renders, Material theme applied, theme toggle switches between light/dark, `config.json` loads at startup

### Ticket 2: Auth feature (service, interceptors, guards, provider)
- **Role:** frontend-developer
- **Scope:** Create the complete `features/auth/` feature with README.md:
  - `types.ts` — AuthUser, LoginRequest, LoginResponse, AuthCheckResponse (includes permissions[])
  - `auth.service.ts` — login, logout, checkSession (loads user + permissions), refreshToken, user/permissions signals, hasPermission()/hasPermission$() methods
  - `credentials.interceptor.ts` — adds `withCredentials: true` to all requests
  - `auth-error.interceptor.ts` — 401 refresh with retry queue, 403 snackbar, 5xx snackbar
  - `auth.guard.ts` — checks isAuthenticated, redirects to /login
  - `permission.guard.ts` — factory `permissionGuard(perm)`, redirects to /home if unauthorized
  - `auth.provider.ts` — `provideAuth()` wires interceptors + APP_INITIALIZER for checkSession
  - `index.ts` — barrel exports for all public API
  - `README.md` — integration guide, how it works, backend contract, constraints, portability
- **Acceptance:** `provideAuth()` wires everything in one call, session restores on refresh via `/auth/check`, permissions loaded from server, `permissionGuard('users:read')` blocks unauthorized routes, 401 triggers refresh retry, feature README is complete

### Ticket 3: Shared layout component
- **Role:** frontend-developer
- **Scope:** Create `features/shared/` with README.md, `components/layout/` with mat-sidenav-container, responsive sidenav (side mode desktop, over mode mobile), nav items (Welcome, Users — visible only if `hasPermission$('users:read')`, Smoke Tests), active route highlighting, user info at bottom, theme toggle (mat-slide-toggle), logout button. Include `app-config.service.ts` and `theme.service.ts`.
- **Acceptance:** Layout renders with sidenav, responsive breakpoint works, nav items use permission-based visibility, theme toggle works, logout works, feature README is complete

---

## Phase 2: Pages (depends on Phase 1)

These depend on Phase 1 tickets being merged.

### Ticket 4: Login page
- **Depends on:** Ticket 1, Ticket 2
- **Role:** frontend-developer
- **Scope:** Create `features/auth/pages/login/` with email + password form (ReactiveFormsModule), error handling on 401, redirect to `/home` on success. Full-page centered card layout (no sidenav). Email field label (Keycloak uses email as username).
- **Acceptance:** All criteria from feature-list.md "Login Page" section

### Ticket 5: Welcome page
- **Depends on:** Ticket 1, Ticket 2, Ticket 3
- **Role:** frontend-developer
- **Scope:** Create `features/home/` with README.md, HomePage, and FeatureCard component. Welcome message with user's firstName. Brief intro paragraph explaining this is a benchmark application. Feature cards describing available pages (User Management — visible only if `hasPermission$('users:read')`, Smoke Tests) with icons, descriptions, and navigation links. No API calls — purely static using auth service data.
- **Acceptance:** All criteria from feature-list.md "Welcome Page" section, feature README complete

### Ticket 6: User management page
- **Depends on:** Ticket 1, Ticket 2, Ticket 3
- **Role:** frontend-developer
- **Scope:** Create `features/users/` with README.md, types, UsersService (full CRUD: getUsers with pagination/search/sort, getUserById, createUser, updateUser, deleteUser, toggleEnabled), UserManagementPage with mat-table (server-side sort + pagination + search), CreateUserDialog (email, firstName, lastName, temporaryPassword, role), UserDetailDialog (view + edit form: firstName, lastName, role + delete button), ConfirmDialog for delete, enable/disable mat-slide-toggle per row, role badges (mat-chip). Use `hasPermission$()` for create/edit/delete button visibility.
- **Acceptance:** All criteria from feature-list.md "User Management Page" section, feature README complete

### Ticket 7: Smoke tests page
- **Depends on:** Ticket 1, Ticket 2, Ticket 3
- **Role:** frontend-developer
- **Scope:** Create `features/smoke-tests/` with README.md, types, HealthService (calls `/health`), SmokeTestsPage. Display health result (service, status, timestamp as relative time), "Check Now" button, auto-refresh every 30s.
- **Acceptance:** All criteria from feature-list.md "Smoke Test Page" section, feature README complete

---

## Phase 3: Integration (depends on Phase 2)

### Ticket 8: Routing wiring + final integration
- **Depends on:** Ticket 4, Ticket 5, Ticket 6, Ticket 7
- **Role:** frontend-developer
- **Scope:** Wire all routes in `app.routes.ts`, ensure lazy loading works, verify nav items link correctly, test all guards (auth redirect to /login, admin redirect for non-admins), verify 404 handling, verify theme persists across navigation, verify session restore on refresh
- **Acceptance:** All routes work, guards protect correctly, lazy loading verified, nav items highlight active route, theme persists, session survives page refresh

---

## Notes for the Team Lead

1. **Create all Phase 1 tickets at once** — they have no dependencies and will run in parallel (3 frontend developers working simultaneously)
2. **Phase 2 tickets wait for Phase 1 to merge** — set `dependsOn` correctly so the engine doesn't spawn agents until the foundation is merged
3. **Each ticket's task spec should reference** the relevant sections from `feature-list.md`, `design-spec.md`, `coding-standards.md`, and `api-contract.md`
4. **The spec files should be written to** `.dev-team/plans/p-benchmark/tasks/benchmark-frontend/{feature}/{concern}/task.md`
5. **All tickets target** `local-scain` branch
6. **Cookie-based auth is critical** — `credentialsInterceptor` adds `withCredentials: true` globally. No per-request configuration.
7. **No localStorage for tokens** — the browser handles cookies automatically. The frontend only stores user profile + permissions in signals (in-memory).
8. **Permission-based access control** — use `permissionGuard(perm)` on routes, `hasPermission$(perm)` in templates. Permissions come from `GET /auth/check`, resolved server-side. Frontend checks are UX-only; backend enforces.
9. **Every feature delivers a README.md** — follows `docs/development/documentation-standard.md`. The README is part of the ticket, not a follow-up.
10. **Comments explain "why", never "what"** — follows the global documentation standard. No JSDoc on private methods, no commented-out code, no TODOs without linked issues.
