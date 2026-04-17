# Benchmark Frontend — Handoff Document

## What This Is

A controlled test application for benchmarking THE Dev Team's autonomous agent pipeline. The goal: give the Team Lead this spec and see if it can autonomously build a complete Angular frontend through the ticket system.

The backend is a NestJS application with Keycloak authentication, PostgreSQL, and full user management CRUD. It's already built and deployed.

## Documentation-Driven Development

This benchmark uses a docs-driven model: **the documentation IS the specification**. To change the system, change the docs first, then agents make the code match.

```
docs/ (the spec) ──→ tickets ──→ agents build ──→ designer verifies against flows.md
```

The docs are always current because they drove the implementation. There is no "update docs after shipping" step.

## Documentation Structure

```
docs/
├── overview.md                    # What this app is, architecture, page index
├── standards/
│   ├── coding.md                  # Angular patterns, project structure, file naming
│   └── design.md                  # Colors, typography, component patterns, spacing
├── pages/
│   ├── login/
│   │   ├── requirements.md        # What the page does, acceptance criteria
│   │   ├── components.md          # Component inventory, layout, state, dependencies
│   │   ├── flows.md               # Step-by-step user flows (the acceptance tests)
│   │   └── test-data.md           # Credentials, error scenarios, API examples
│   ├── welcome/
│   │   ├── requirements.md
│   │   ├── components.md
│   │   └── flows.md
│   ├── users/
│   │   ├── requirements.md
│   │   ├── components.md
│   │   ├── flows.md
│   │   └── test-data.md
│   └── smoke-tests/
│       ├── requirements.md
│       ├── components.md
│       └── flows.md
└── shared/
    ├── auth/
    │   ├── requirements.md        # Auth feature: public API, constraints, portability
    │   ├── flows.md               # Session lifecycle, refresh, guards, error handling
    │   └── test-data.md           # Test accounts, permission model, cookie behavior
    ├── layout/
    │   ├── requirements.md
    │   └── flows.md
    └── theme/
        ├── requirements.md
        └── flows.md
```

## Other Files

| File | Purpose |
|------|---------|
| `api-contract.md` | Every backend endpoint with exact request/response shapes |
| `decomposition-plan.md` | How to break the work into 8 tickets across 3 phases |
| `HANDOFF.md` | This file |

## How to Run the Benchmark

### 1. Prep

Make sure the backend and frontend are deployed and the ticket system is clean:

```bash
# Verify no stale tickets
curl -s http://devteam.shawns-macbook-pro/api/tickets

# Clean up if needed
kubectl exec deployment/the-dev-team-backend -n the-dev-team -- \
  bash -c 'rm -rf /workspace/.dev-team/tickets/t-*'
```

### 2. Hand Off to Team Lead

Open the Team dashboard, click the chat bubble (Team Lead), and send:

> I need you to build a benchmark frontend application. All the specs are in `benchmarking/build-a-frontend/`. Start by reading `docs/overview.md` for the full picture, then read the `decomposition-plan.md` for how to break the work into tickets.
>
> Each ticket references a docs directory — read all files in that directory for the complete requirements, component inventory, user flows, and test data.
>
> Follow the decomposition plan exactly. Create Phase 1 tickets first. Phase 2 depends on Phase 1.

### 3. Monitor

Watch the dashboard as agents spawn, work, and flow through the pipeline:

- **Do agents follow the coding standards?** (standalone components, inject(), signals, OnPush)
- **Do agents use cookie-based auth correctly?** (credentialsInterceptor, no localStorage, /auth/check on bootstrap, permissions from server)
- **Do agents use permission-based access control?** (permissionGuard on routes, hasPermission$ in templates, not hardcoded role checks)
- **Do agents deliver feature READMEs?** (integration, flow, contracts, constraints)
- **Does the designer catch real issues?** (color contrast, broken Material components, scalloped borders)
- **Does the designer verify against flows.md?** (step-by-step verification)
- **Does the iteration loop resolve issues?** (or does it loop forever)
- **How many agents/iterations does each ticket take?**
- **Does the dependency graph work?** (Phase 2 should not start until Phase 1 merges)

### 4. Evaluate

After all tickets reach `approved`:

**Code quality:**
- [ ] All components are standalone with OnPush
- [ ] No constructor injection (all use inject())
- [ ] No FormsModule/ngModel (all ReactiveFormsModule)
- [ ] No `any` types
- [ ] Feature-based structure matches standards/coding.md
- [ ] Runtime config via AppConfigService, no build-time env vars
- [ ] Cookie-based auth — no localStorage tokens, no Authorization header attachment
- [ ] `credentialsInterceptor` adds `withCredentials: true` globally
- [ ] `authErrorInterceptor` handles 401 refresh with retry queue
- [ ] `provideAuth()` wires everything in one call in app.config.ts
- [ ] AuthService uses signals for user state + permissions
- [ ] Permission-based guards (`permissionGuard('users:read')`) not role-based
- [ ] `hasPermission$()` used for template visibility (nav items, buttons)
- [ ] Permissions resolved from backend, not mapped client-side
- [ ] Every feature has a README.md following documentation standard
- [ ] Comments explain "why" only — no "what" comments, no commented-out code

**Design quality:**
- [ ] Dark mode works — no white/light backgrounds leaking through
- [ ] Light mode works — theme toggle switches cleanly
- [ ] Form fields have clean outlines (no scalloped borders)
- [ ] Buttons are clearly visible against dark surfaces
- [ ] Status indicators use correct colors (green/red)
- [ ] Role badges use correct colors (admin = blue, user = gray)
- [ ] Responsive layout works at mobile/tablet/desktop
- [ ] No branding or company names

**Functionality:**
- [ ] Login works (email + password, cookie-based)
- [ ] Session persists on page refresh (via /auth/check)
- [ ] authGuard on parent route redirects unauthenticated users to /login
- [ ] permissionGuard('users:read') blocks unauthorized users from /users (redirects to /home)
- [ ] Welcome page shows user's name and feature cards with navigation
- [ ] User Management card uses hasPermission$('users:read') for visibility
- [ ] User table has server-side sort, pagination, and search
- [ ] Create user dialog works (email, name, temporary password, role)
- [ ] Edit user dialog works (name, role)
- [ ] Delete user works with confirmation
- [ ] Enable/disable toggle works
- [ ] Smoke tests show health status with auto-refresh and "Check Now"
- [ ] Theme toggle persists preference to backend
- [ ] Logout clears session and redirects to /login

**Pipeline metrics:**
- Total tickets: ___
- Total agents spawned: ___
- Design review iterations (changes requested): ___
- Tickets that failed and needed retry: ___
- Total time from first ticket created to last approved: ___

## Known Gaps to Watch For

1. **Global styles.scss overrides** — If the Angular project has a global `border-radius` rule for Material components, it will break the notched outline on mat-form-field. The design spec explicitly warns against this.

2. **Stale sandbox builds** — If an agent makes code changes but the sandbox doesn't get rebuilt properly, the designer will see the old version and request changes that were already made.

3. **The designer may be too strict or too lenient** — Watch the design review handoff notes to see if the checklist is calibrated right.

4. **No memory yet** — Each agent is a fresh session. If an agent discovers something non-obvious (like the border-radius issue), that knowledge is lost.

5. **PR target branch** — All PRs should target `local-scain`, not `main`.

6. **Cookie-based auth cross-origin** — `withCredentials: true` is essential for cookies to be sent. If this is missing, every authenticated request will fail with 401.

7. **Keycloak email-as-username** — The login form should label the field "Email" not "Username". The Create User form takes `email` and Keycloak derives the username from it.
