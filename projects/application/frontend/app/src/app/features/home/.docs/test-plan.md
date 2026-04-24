# Home — Test Plan

Each item maps to an acceptance criterion in `spec.md` or a flow in `flows.md`. Paths are relative to `projects/application/frontend/app/src/app/features/home/` unless noted otherwise.

## Route Tests

- [ ] `GET /` (authenticated) redirects to `/home` — verify `app.routes.ts` default redirect is `'home'`
- [ ] `GET /home` (authenticated) loads `HomePage` via lazy import
- [ ] `GET /home` (unauthenticated) redirects to `/login` via `authGuard`
- [ ] `GET /smoke-tests` (authenticated) still loads `SmokeTestsPage` — route unchanged

## Greeting Tests

- [ ] When `AuthService.user()` returns `{ firstName: 'Alice', username: 'alice01' }` → heading renders "Welcome back, Alice"
- [ ] When `AuthService.user()` returns `{ firstName: undefined, username: 'bob99' }` → heading renders "Welcome back, bob99"
- [ ] When `AuthService.user()` returns `{ firstName: '', username: 'carol' }` → heading renders "Welcome back, carol" (empty string is falsy, falls through to username)
- [ ] Greeting updates reactively if the user signal changes (simulate with `signal.set`)

## Status Row Tests

- [ ] `BackendHealthCheckComponent` renders inside the status row (`<app-backend-health-check>` present in DOM)
- [ ] `TypeormDatabaseClientComponent` renders inside the status row (`<app-typeorm-database-client>` present in DOM)
- [ ] Both components are imported from `@features/testing-tools` — no local copies exist under `features/home/`
- [ ] Status row uses flex layout — both cards render side-by-side at ≥600px viewport
- [ ] Each component's "Check" button triggers its own API call and updates its own card (inherited behavior, no home-specific logic)

## Feature Card Grid Tests

### Data sourcing
- [ ] Cards are derived from `navigationConfig.items` — not hardcoded in the template or component
- [ ] Adding a new item to `navigationConfig` (with a `route`) causes a new card to appear without touching home feature code
- [ ] Removing an item from `navigationConfig` removes its card

### Flattening
- [ ] Top-level items with a `route` produce cards (Smoke Tests, Chat)
- [ ] Nested children with a `route` produce cards (Admin → Users becomes a "Users" card)
- [ ] Parent items without a `route` do not produce cards (the "Admin" group itself has no card)
- [ ] If a parent item had both a `route` AND `children`, both the parent and children would produce cards (edge case — not in current config, but logic should handle it)

### Permission filtering
- [ ] Items with no `permission` field render for all authenticated users
- [ ] Items with `permission: 'users:read'` render only when `AuthService.hasPermission('users:read')` returns true
- [ ] For a `user`-role user: Smoke Tests ✓, Chat ✓, Users ✗ (2 cards)
- [ ] For an `admin`-role user: Smoke Tests ✓, Chat ✓, Users ✓ (3 cards)
- [ ] Excluded cards are absent from the DOM — not rendered hidden or disabled

### Card rendering
- [ ] Each card displays a `mat-icon` matching the item's `icon` field
- [ ] Each card displays the item's `label` as the title
- [ ] Each card has a `routerLink` pointing to the item's `route`
- [ ] Clicking a card navigates to the correct route

### Responsive layout
- [ ] At viewport ≥960px: cards render in 3 columns
- [ ] At viewport ≥600px and <960px: cards render in 2 columns
- [ ] At viewport <600px: cards render in 1 column
- [ ] Grid gap is 16px

## Component Architecture Tests

- [ ] `HomePage` uses `ChangeDetectionStrategy.OnPush`
- [ ] `FeatureCardComponent` uses `ChangeDetectionStrategy.OnPush`
- [ ] Both components are standalone (`standalone: true` or Angular v19+ default)
- [ ] `home.module.ts` re-exports `HomePage` and `FeatureCardComponent`
- [ ] `index.ts` barrel-exports all public symbols
- [ ] No code is duplicated from `testing-tools` — health check components are imported, not copied

## E2E Scenarios

- [ ] Login as `admin` → lands on `/home` → greeting shows admin's first name → 3 feature cards visible (Smoke Tests, Chat, Users) → status row shows both health-check cards
- [ ] Login as `user` (non-admin) → lands on `/home` → greeting shows user's name → 2 feature cards visible (Smoke Tests, Chat) → "Users" card is absent
- [ ] From `/home`, click "Smoke Tests" card → navigates to `/smoke-tests` → page loads correctly
- [ ] From `/home`, click "Chat" card → navigates to `/chat` → chat page loads
- [ ] From `/home`, click "Users" card (admin) → navigates to `/admin/users` → user management page loads
- [ ] Navigate directly to `/smoke-tests` via URL → still works (route not removed)
- [ ] Nav menu still shows "Smoke Tests" and clicking it navigates correctly
- [ ] Resize browser from desktop → tablet → mobile: card grid reflows from 3 → 2 → 1 columns
