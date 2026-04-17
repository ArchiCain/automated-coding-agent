# Benchmark Frontend — Handoff Document

## What This Is

A controlled test application for benchmarking THE Dev Team's autonomous agent pipeline. The goal: give the Team Lead this spec and see if it can autonomously build a complete Angular frontend through the ticket system.

The backend is a NestJS application with Keycloak authentication, PostgreSQL, and full user management CRUD. It's already built and deployed.

## Files in This Directory

| File | Purpose |
|------|---------|
| `feature-list.md` | High-level features with acceptance criteria per page |
| `design-spec.md` | Dark + light mode design system — colors, typography, spacing, component patterns, anti-patterns |
| `coding-standards.md` | Angular patterns (standalone components, signals, inject(), OnPush, cookie-based auth), project structure, file naming, service patterns |
| `api-contract.md` | Every backend endpoint with request/response shapes — the frontend consumes these exactly |
| `decomposition-plan.md` | How the Team Lead should break this into tickets — 8 tickets across 3 phases with dependency graph |
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

Open the Team dashboard at `http://devteam.shawns-macbook-pro/`, click the chat bubble (Team Lead), and send something like:

> I need you to build a benchmark frontend application. All the specs are in `benchmarking/build-a-frontend/`. Read these files:
> - `feature-list.md` — the features and acceptance criteria
> - `design-spec.md` — the complete design system (dark + light themes)
> - `coding-standards.md` — Angular patterns and project structure
> - `api-contract.md` — the backend API endpoints (cookie-based Keycloak auth)
> - `decomposition-plan.md` — how to break the work into tickets
>
> Follow the decomposition plan exactly. Create the task specs and tickets for Phase 1 first. Phase 2 tickets should depend on Phase 1.

### 3. Monitor

Watch the dashboard as agents spawn, work, and flow through the pipeline. Key things to observe:

- **Do agents follow the coding standards?** (standalone components, inject(), signals, OnPush)
- **Do agents use cookie-based auth correctly?** (credentialsInterceptor, no localStorage tokens, /auth/check on bootstrap, permissions from server)
- **Do agents use permission-based access control?** (permissionGuard on routes, hasPermission$ in templates, not hardcoded role checks)
- **Do agents deliver feature READMEs?** (integration, flow, contracts, constraints)
- **Does the designer catch real issues?** (color contrast, broken Material components, missing dark mode, scalloped borders)
- **Does the iteration loop resolve issues?** (or does it loop forever)
- **How many agents/iterations does each ticket take?**
- **Does the dependency graph work?** (Phase 2 tickets should not start until Phase 1 merges)

### 4. Evaluate

After all tickets reach `approved`:

**Code quality:**
- [ ] All components are standalone with OnPush
- [ ] No constructor injection (all use inject())
- [ ] No FormsModule/ngModel (all ReactiveFormsModule)
- [ ] No `any` types
- [ ] Feature-based structure matches coding-standards.md
- [ ] Runtime config via AppConfigService, no build-time env vars
- [ ] Cookie-based auth — no localStorage tokens, no Authorization header attachment
- [ ] `credentialsInterceptor` adds `withCredentials: true` globally
- [ ] `authErrorInterceptor` handles 401 refresh with retry queue
- [ ] `provideAuth()` wires everything in one call in app.config.ts
- [ ] AuthService uses signals for user state + permissions
- [ ] Permission-based guards (`permissionGuard('users:read')`) instead of role-based
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

Based on testing done so far:

1. **Global styles.scss overrides** — If the Angular project has a global `border-radius` rule for Material components, it will break the notched outline on mat-form-field. The design spec explicitly warns against this.

2. **Stale sandbox builds** — If an agent makes code changes but the sandbox doesn't get rebuilt properly, the designer will see the old version and request changes that were already made. The devops agent needs to do a clean rebuild.

3. **The designer may be too strict or too lenient** — Watch the design review handoff notes to see if the checklist is calibrated right. If it's rejecting good work, loosen the prompt. If it's approving broken UI, tighten it.

4. **No memory yet** — Each agent is a fresh session. If an agent discovers something non-obvious (like the border-radius issue), that knowledge is lost. The crystallization pipeline needs to be built.

5. **PR target branch** — All PRs should target `local-scain`, not `main`. The `push_and_pr` tool defaults to `local-scain` but agents may override it.

6. **Cookie-based auth cross-origin** — `withCredentials: true` is essential for cookies to be sent. If this is missing, every authenticated request will fail with 401. This is the single most likely source of "it works locally but fails in the sandbox" bugs.

7. **Keycloak email-as-username** — The login form should label the field "Email" not "Username". The Create User form takes `email` and Keycloak derives the username from it. Agents may get confused by the `username` field in API responses — it equals the email.
