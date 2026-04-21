# Navigation — Test Plan

Unit tests are component-level with Angular `TestBed` + Vitest (`angular.json:72-73`). E2E assertions target the mounted layout at `/smoke-tests` (default post-login route).

## Behavior tests — `NavigationTreeComponent`

- [ ] Given `items` with one flat entry, renders exactly one `<a mat-list-item>` with the provided `routerLink` and label (`navigation-tree.component.ts:37-42`).
- [ ] When the item has an `icon`, the rendered `<mat-icon matListItemIcon>` contains that Material icon ligature; when `icon` is undefined, no `<mat-icon>` renders for that row (`:38-40`).
- [ ] Given `items` with a parent that has `children`, renders a `<mat-expansion-panel class="nav-group">` with `mat-elevation-z0` and a nested `<mat-nav-list>` containing one `<a mat-list-item>` per child (`:16-35`).
- [ ] Group headers show the parent `icon` (when present) and `label` but have no `routerLink` — clicking the header only toggles the panel (`:17-24`).
- [ ] Navigating to a route matching a leaf item's `routerLink` adds the `active-link` class to that `<a mat-list-item>` and removes it from any previously active row.
- [ ] The `active-link` class applies `background-color: var(--app-hover-overlay)` and `font-weight: 600` (`:57-60`).
- [ ] `@for` loops use `track item.id` / `track child.id` — asserted by rendering two items with distinct ids and confirming Angular does not throw (`:14`, `:26`).
- [ ] `ChangeDetectionStrategy.OnPush` is declared (`:62`).
- [ ] Permission metadata is ignored: rendering with an item that has `permission: 'users:read'` produces the same DOM as an identical item without the field — no filtering logic runs (regression test guarding against silent behavior change).

## Behavior tests — `LeftNavigationSidebarComponent`

- [ ] Renders a `<nav class="sidebar">` containing exactly one `<app-navigation-tree>` (`left-navigation-sidebar.component.ts:10-14`).
- [ ] The tree receives `items` equal to `navigationConfig.items` from `@features/navigation-config` (`:28`).
- [ ] Computed styles on `.sidebar`: `width: 280px`, `height: 100%`, `overflow-y: auto`, `border-right` present, background from `var(--app-bg-paper)` (`:15-23`).
- [ ] `ChangeDetectionStrategy.OnPush` is declared (`:24`).

## Behavior tests — `LeftNavigationDrawerComponent`

- [ ] Renders a `<mat-drawer mode="over">` with `width: 280px` and `var(--app-bg-paper)` background (`left-navigation-drawer.component.ts:12-25`).
- [ ] Setting `opened` input to `true` opens the drawer; setting it to `false` closes it (one-way binding via `[opened]="opened()"`, `:13`).
- [ ] When the underlying `<mat-drawer>` emits `(closed)`, the component's `closed` output fires exactly once with `void` (`:15`, `:32`).
- [ ] `navItems` equals `navigationConfig.items` and is forwarded to the inner `<app-navigation-tree>` (`:18`, `:33`).
- [ ] `ChangeDetectionStrategy.OnPush` is declared (`:27`).

## Integration / E2E

- [ ] On desktop (>=1200px) after login, the persistent sidebar is visible at 280px and shows Smoke Tests, Chat, and an Admin group containing Users (mirrors `navigation-config/navigation-config.ts:4-31`).
- [ ] Clicking Chat navigates the outlet to `/chat` and marks the Chat row as active (bold, highlighted background).
- [ ] Clicking the Admin header expands the panel and reveals the Users child; the header itself does not navigate.
- [ ] Clicking Users navigates to `/admin/users` regardless of the signed-in user's permissions — the Users link is visible and clickable even without `users:read` (documents the unenforced-permission reality).
- [ ] On viewports below 1200px, tapping the header menu button opens the overlay sidenav containing the same navigation tree; tapping a nav item closes the overlay and navigates.

## Non-goals for this test plan

- Responsive breakpoint behavior of the surrounding `mat-sidenav` — covered by the `layouts` feature test plan.
- `navigationConfig` content itself (item ids, routes, icons) — covered by the `navigation-config` feature test plan.
