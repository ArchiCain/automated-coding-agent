# Home — Spec

## What it is

A welcome/landing page at `/home` that replaces `/smoke-tests` as the application's default route after login. It greets the authenticated user by name, shows a quick system-health row, and presents a card grid linking to the application's main features. The Smoke Tests page remains at `/smoke-tests` and in the nav menu — it simply stops being the default landing.

## How it behaves

### Greeting

The page reads the current user from `AuthService.user()`. It renders a heading: **"Welcome back, {displayName}"** where `displayName` is built from the `User` object:

- If `firstName` is present → use `firstName`.
- Otherwise fall back to `username`.

The greeting is reactive — if the user signal updates (unlikely mid-session, but possible after a token refresh), the heading updates.

### Quick status row

Below the greeting, a horizontal row contains two reused components imported directly from `@features/testing-tools`:

| Component | Purpose |
|---|---|
| `BackendHealthCheckComponent` (`app-backend-health-check`) | Shows backend health status with a manual "Check" button |
| `TypeormDatabaseClientComponent` (`app-typeorm-database-client`) | Shows database connection status with a manual "Check" button |

These components are used as-is — no wrapping, no re-implementation. They bring their own Material cards, spinners, and styling. The home page simply hosts them side-by-side in a flex row.

### Feature card grid

Below the status row, a grid of Material cards links to the application's features. The cards are sourced from `navigationConfig.items` (imported from `@features/navigation-config`).

**Flattening:** The config supports nested `children` (e.g., Admin → Users). The home page flattens the tree: any item with a `route` becomes a card; parent items that have no `route` of their own (like the "Admin" group) are skipped, but their children are included as individual cards. This produces a flat card list: Smoke Tests, Chat, Users.

**Permission filtering:** Each `NavigationItem` may carry a `permission` string. Before rendering, the page checks `AuthService.hasPermission(item.permission)` for every item that has one. Items without a `permission` field render for all authenticated users. Items the user lacks permission for are excluded entirely — no disabled state, no "locked" card, just absent.

**Card content:** Each card shows:

- A Material icon (`mat-icon`) matching the item's `icon` field.
- The item's `label` as card title.
- The card is a clickable link navigating to the item's `route` via `routerLink`.

**Layout:** CSS grid, responsive — 3 columns on desktop (≥960px), 2 on tablet (≥600px), 1 on mobile. Gap of 16px.

### Route configuration

In `app.routes.ts`, the default redirect changes:

```
{ path: '', redirectTo: 'home', pathMatch: 'full' }
```

A new child route is added:

```typescript
{
  path: 'home',
  loadComponent: () =>
    import('./features/home/pages/home.page').then(m => m.HomePage),
}
```

All existing routes (`smoke-tests`, `chat`, `admin/users`, etc.) remain unchanged.

## Feature directory structure

Following the `features/chat/` template:

```
features/home/
├── .docs/
│   ├── spec.md
│   ├── flows.md
│   └── test-plan.md
├── components/
│   └── feature-card/
│       └── feature-card.component.ts
├── pages/
│   └── home.page.ts
├── home.module.ts
├── index.ts
└── types.ts
```

- `HomePage` — standalone component, `ChangeDetectionStrategy.OnPush`, hosts greeting + status row + card grid.
- `FeatureCardComponent` — standalone component, `OnPush`, renders a single card. Accepts a `NavigationItem` input.
- `home.module.ts` — thin `NgModule` re-exporting `HomePage` and `FeatureCardComponent`.
- `index.ts` — barrel exports.
- `types.ts` — any home-specific types (may re-export `NavigationItem` for convenience).

## Acceptance criteria

- [ ] Navigating to `/` after login redirects to `/home` (not `/smoke-tests`).
- [ ] `/smoke-tests` still works and is still in the nav menu.
- [ ] The greeting shows `firstName` when available, otherwise `username`.
- [ ] `BackendHealthCheckComponent` renders in the status row and its "Check" button works.
- [ ] `TypeormDatabaseClientComponent` renders in the status row and its "Check" button works.
- [ ] Feature cards are sourced from `navigationConfig.items`, not hardcoded.
- [ ] Nested nav items (Admin → Users) are flattened — "Users" appears as its own card.
- [ ] Parent-only nav items with no `route` (e.g., "Admin") do not produce a card.
- [ ] Cards for items requiring a permission the user lacks are not rendered.
- [ ] Cards for items with no `permission` field render for all authenticated users.
- [ ] Each card displays the correct Material icon, label, and routes to the correct path on click.
- [ ] Card grid is responsive: 3 cols ≥960px, 2 cols ≥600px, 1 col below.
- [ ] The home route is lazy-loaded.
- [ ] All components use `ChangeDetectionStrategy.OnPush`.
- [ ] All components are standalone (no `NgModule` required to use them, module is a convenience re-export).

## Code map

Paths are relative to `projects/application/frontend/app/`.

| Concern | File · detail |
|---|---|
| User signal (readonly) | `src/app/features/keycloak-auth/services/auth.service.ts:30` — `readonly user = this._user.asReadonly()` |
| User type (`firstName`, `lastName`, `username`) | `src/app/features/keycloak-auth/types.ts:1-8` |
| Permission check | `auth.service.ts:42` — `hasPermission(permission: Permission): boolean` |
| Permission type | `src/app/features/keycloak-auth/permissions/permissions.types.ts` |
| Navigation config (source of truth for cards) | `src/app/features/navigation-config/navigation-config.ts` |
| NavigationItem type (`id`, `label`, `icon`, `route`, `permission`, `children`) | `src/app/features/navigation-config/types.ts` |
| BackendHealthCheckComponent (reuse) | `src/app/features/testing-tools/components/backend-health-check/backend-health-check.component.ts` |
| TypeormDatabaseClientComponent (reuse) | `src/app/features/testing-tools/components/typeorm-database-client/typeorm-database-client.component.ts` |
| Barrel export for testing-tools | `src/app/features/testing-tools/index.ts` |
| Current default redirect | `src/app/app.routes.ts:20` — `redirectTo: 'smoke-tests'` |
| Route array (add `home` route here) | `src/app/app.routes.ts:18-45` |

## Known gaps

None anticipated — this is a straightforward composition of existing primitives.
