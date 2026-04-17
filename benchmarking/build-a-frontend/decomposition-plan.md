# Benchmark Frontend — Decomposition Plan

How the Team Lead should decompose this into tickets. Order matters — dependencies are explicit.

Each ticket references a docs directory. The agent reads all files in that directory to understand requirements, components, flows, and test data.

---

## Phase 1: Foundation (no dependencies)

These tickets have zero dependencies and can all run in parallel.

### Ticket 1: Project scaffolding + global styles + theming
- **Role:** frontend-developer
- **Docs:** `docs/standards/`, `docs/shared/theme/`
- **Scope:** Create the Angular project, set up `styles.scss` with both dark and light Material themes, configure `app.config.ts` with providers, create `app.routes.ts` skeleton, create `config.json`, set up `AppConfigService`, set up `ThemeService` (GET/PUT `/api/theme`, applies class to `<body>`). Note: `provideAuth()` wiring happens in Ticket 2.
- **Acceptance:** `ng serve` works, dark background renders, Material theme applied, theme toggle switches between light/dark, `config.json` loads at startup

### Ticket 2: Auth feature (service, interceptors, guards, provider)
- **Role:** frontend-developer
- **Docs:** `docs/shared/auth/`
- **Scope:** Create the complete `features/auth/` feature:
  - `types.ts`, `auth.service.ts`, `credentials.interceptor.ts`, `auth-error.interceptor.ts`
  - `auth.guard.ts`, `permission.guard.ts`, `auth.provider.ts`, `index.ts`, `README.md`
- **Acceptance:** `provideAuth()` wires everything in one call, session restores on refresh, permissions loaded from server, `permissionGuard('users:read')` blocks unauthorized routes, 401 triggers refresh retry, feature README complete

### Ticket 3: Shared layout component
- **Role:** frontend-developer
- **Docs:** `docs/shared/layout/`
- **Scope:** Create `features/shared/` with `components/layout/`, `app-config.service.ts`, `theme.service.ts`, `README.md`. Responsive sidenav with permission-based nav visibility, theme toggle, user info, logout.
- **Acceptance:** Layout renders, responsive breakpoints work, nav items use `hasPermission$()`, theme toggle works, logout works, feature README complete

---

## Phase 2: Pages (depends on Phase 1)

These depend on Phase 1 tickets being merged.

### Ticket 4: Login page
- **Depends on:** Ticket 1, Ticket 2
- **Role:** frontend-developer
- **Docs:** `docs/pages/login/`
- **Scope:** Create `features/auth/pages/login/`. Full-page centered card, email + password form, error handling, redirect on success.
- **Acceptance:** All flows in `docs/pages/login/flows.md` pass. All test scenarios in `test-data.md` verified.

### Ticket 5: Welcome page
- **Depends on:** Ticket 1, Ticket 2, Ticket 3
- **Role:** frontend-developer
- **Docs:** `docs/pages/welcome/`
- **Scope:** Create `features/home/` with HomePage, FeatureCard component, `README.md`. Permission-based card visibility.
- **Acceptance:** All flows in `docs/pages/welcome/flows.md` pass. Feature README complete.

### Ticket 6: User management page
- **Depends on:** Ticket 1, Ticket 2, Ticket 3
- **Role:** frontend-developer
- **Docs:** `docs/pages/users/`
- **Scope:** Create `features/users/` with full CRUD: UsersService, UserManagementPage, CreateUserDialog, UserDetailDialog, ConfirmDialog, `README.md`. Server-side sort/pagination/search, permission-based button visibility.
- **Acceptance:** All flows in `docs/pages/users/flows.md` pass. All test scenarios in `test-data.md` verified. Feature README complete.

### Ticket 7: Smoke tests page
- **Depends on:** Ticket 1, Ticket 2, Ticket 3
- **Role:** frontend-developer
- **Docs:** `docs/pages/smoke-tests/`
- **Scope:** Create `features/smoke-tests/` with HealthService, SmokeTestsPage, `README.md`. Health display with auto-refresh and manual check.
- **Acceptance:** All flows in `docs/pages/smoke-tests/flows.md` pass. Feature README complete.

---

## Phase 3: Integration (depends on Phase 2)

### Ticket 8: Routing wiring + final integration
- **Depends on:** Ticket 4, Ticket 5, Ticket 6, Ticket 7
- **Role:** frontend-developer
- **Docs:** `docs/overview.md`, `docs/shared/auth/flows.md`
- **Scope:** Wire all routes in `app.routes.ts`, ensure lazy loading, verify guards, verify theme persists, verify session restore on refresh, verify all nav items link correctly.
- **Acceptance:** All routes work, guards protect correctly, lazy loading verified, nav items highlight active route, theme persists, session survives page refresh.

---

## Notes for the Team Lead

1. **Each ticket references a docs directory** — the agent reads all files in that directory for requirements, components, flows, and test data
2. **Create all Phase 1 tickets at once** — they have no dependencies and run in parallel
3. **Phase 2 tickets wait for Phase 1 to merge** — set `dependsOn` correctly
4. **All tickets target** `local-scain` branch
5. **Cookie-based auth** — `credentialsInterceptor` adds `withCredentials: true` globally
6. **Permission-based access** — `permissionGuard(perm)` on routes, `hasPermission$(perm)` in templates. Permissions from `GET /auth/check`, resolved server-side.
7. **Every feature delivers a README.md** — follows `docs/development/documentation-standard.md`
8. **Comments explain "why", never "what"** — follows the global documentation standard
9. **Flows are the acceptance test** — the designer agent verifies by following flows step-by-step
