# Navigation — Flows

Traces the three observable flows in the feature: initial render, click/navigate, and the open/close cycle of the drawer variant. Collapse of the shell sidenav itself is handled in the `layouts` feature and is out of scope here — we only describe how this feature participates.

## Flow 1: Nav tree render (desktop, persistent sidebar)

1. `AppLayoutComponent` mounts and evaluates `layout.showPersistentSidebar()` (`features/layouts/services/layout.service.ts:5-9`, `app-layout.component.html:5`). On desktop (`min-width: 1200px`) this is true, so it renders `<mat-sidenav mode="side" [opened]="true">` containing `<app-left-navigation-sidebar />` (`app-layout.component.html:6-8`).
2. `LeftNavigationSidebarComponent` instantiates. Its field `navItems = navigationConfig.items` resolves at class-init time from `@features/navigation-config` (`left-navigation-sidebar.component.ts:28`).
3. Its template renders `<nav class="sidebar"><app-navigation-tree [items]="navItems" /></nav>` (`:10-14`). The `.sidebar` wrapper applies `width: 280px; height: 100%; overflow-y: auto; border-right: 1px solid var(--app-divider); background-color: var(--app-bg-paper)` (`:15-23`).
4. `NavigationTreeComponent` receives `items()` via the required signal input (`navigation-tree.component.ts:66`) and iterates with `@for (item of items(); track item.id)` (`:14`).
5. For each item:
   - If `item.children` is defined (the Admin entry), the tree emits a `<mat-expansion-panel class="nav-group" [class.mat-elevation-z0]="true">` (`:16`) whose `<mat-panel-title>` shows the optional icon and `item.label` (`:18-23`). The panel body renders a nested `<mat-nav-list>` iterating `item.children` keyed by `child.id` (`:25-34`).
   - If `item.children` is undefined (Smoke Tests, Chat), the tree emits `<a mat-list-item [routerLink]="item.route" routerLinkActive="active-link">` with optional `<mat-icon matListItemIcon>` and `<span matListItemTitle>` (`:37-42`).
6. Angular router inspects the current URL and applies the `active-link` class to any `[routerLink]` that matches — yielding `background-color: var(--app-hover-overlay); font-weight: 600` (`:57-60`).
7. No filtering step runs against `item.permission` — every item from `navigationConfig.items` (`navigation-config/navigation-config.ts:4-31`) is painted.

## Flow 2: User clicks a leaf nav item

1. User clicks, e.g., the Chat link. `<a mat-list-item [routerLink]="/chat">` triggers Angular's `RouterLink` directive (`navigation-tree.component.ts:37`).
2. The Angular router navigates to `/chat`, matches the route in `app.routes.ts`, runs `authGuard` (`features/keycloak-auth/guards/auth.guard.ts:7-24`), and lazily loads `ChatPage`.
3. `routerLinkActive="active-link"` recomputes on each URL change and toggles the `active-link` class on the newly active `<a mat-list-item>`, removing it from the previously active one.
4. `mat-sidenav-content` swaps the outlet content to the new route. The persistent sidebar stays mounted; no nav re-render is needed because `items()` has not changed.

## Flow 3: User clicks a group header (Admin)

1. User clicks the Admin header. The `<mat-expansion-panel>` toggles its `expanded` state internally — Material handles the animation.
2. Header is **not** a router link — there is no `routerLink` on `<mat-expansion-panel-header>` (`:17-24`). Only the inner `<a mat-list-item>` children (e.g. Users) navigate.
3. Clicking the expanded "Users" child with `routerLink="/admin/users"` behaves exactly as Flow 2. No permission check is performed before navigation, and no permission guard is attached to the route — the link is always active for any authenticated user.

## Flow 4: Overlay drawer render (<1200px) — uses sidebar, not drawer component

1. On tablet/mobile, `layout.showPersistentSidebar()` returns false and `AppLayoutComponent` switches to `<mat-sidenav mode="over" [opened]="layout.drawerOpen()" (closed)="layout.closeDrawer()">` (`app-layout.component.html:9-18`).
2. Inside this overlay sidenav the shell still embeds `<app-left-navigation-sidebar />` (`:16`) — not `<app-left-navigation-drawer />`.
3. User taps the header menu button → `app-header` emits `(menuToggle)` → `AppLayoutComponent` calls `layout.toggleDrawer()`.
4. `LayoutService.drawerOpen` flips to `true`, the `mat-sidenav` slides in, and Flow 1 renders the tree as before (same component, same `navItems`).
5. User taps outside or picks an item → `mat-sidenav` fires `(closed)` → `layout.closeDrawer()` sets `drawerOpen` false → the overlay closes.

## Flow 5: Drawer component open/close (not currently wired — reference only)

1. A host embeds `<app-left-navigation-drawer [opened]="isOpen" (closed)="onClosed()" />`.
2. `LeftNavigationDrawerComponent`'s template sets `[opened]="opened()"` on `<mat-drawer mode="over">` (`left-navigation-drawer.component.ts:12-19`). When `opened()` becomes true, Material animates it in; when false, it animates out.
3. On animation-complete close, `<mat-drawer (closed)="closed.emit()">` fires (`:15`), which propagates to the host via the `closed` output (`:32`).
4. The inner `<app-navigation-tree [items]="navItems" />` renders identically to Flow 1.

Note: no consumer in the current codebase uses this drawer — see `spec.md` Discrepancies.
