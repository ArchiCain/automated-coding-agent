# Navigation — Spec

**Feature directory:** `src/app/features/navigation/`

## Purpose

Presentational layer for the app's left-hand navigation. Takes a static tree of `NavigationItem[]` from the sibling `navigation-config` feature and renders it as a Material `mat-nav-list`, with flat links for leaf items and `mat-expansion-panel` groups for items that carry `children`. Also exposes two shell wrappers (`LeftNavigationSidebarComponent`, `LeftNavigationDrawerComponent`) that consumers can drop into a layout. Does not own the nav data and does not own the open/close mechanism of the surrounding sidenav — that lives in `layouts/` (`features/layouts/services/layout.service.ts`, `app-layout.component.html:4-23`).

## Behavior

- `NavigationTreeComponent` (`components/navigation-tree/navigation-tree.component.ts`) accepts a required `items: NavigationItem[]` signal input (`:66`) and renders it inside a single `<mat-nav-list>` (`:13`).
- For each item:
  - If `item.children` is defined, render a `<mat-expansion-panel class="nav-group">` with `mat-elevation-z0` (flat look) whose header shows the parent `item.icon` (if any) and `item.label`, and whose body is a nested `<mat-nav-list>` of child links (`:15-35`).
  - Otherwise, render `<a mat-list-item [routerLink]="item.route" routerLinkActive="active-link">` with an optional leading `<mat-icon matListItemIcon>` and the label as `matListItemTitle` (`:37-42`).
- `@for` loops use `track item.id` / `track child.id` (`:14`, `:26`) — required by Angular control flow.
- The currently active route receives the `active-link` class via `routerLinkActive`, styled as `background-color: var(--app-hover-overlay); font-weight: 600` (`:57-60`).
- Group headers are non-navigable; children are navigated to directly via `routerLink` — there is no group-level route.
- **Permission metadata is not enforced here.** Child items may carry a `permission: string` field (e.g. `navigation-config/navigation-config.ts:27` sets `users:read` on Admin > Users) but `NavigationTreeComponent` renders every item unconditionally — it does not call `AuthService.hasPermission()` and does not filter. The surrounding router also leaves `/admin/users` unguarded (`app.routes.ts`). See Discrepancies.
- `LeftNavigationSidebarComponent` (`components/left-navigation-sidebar/left-navigation-sidebar.component.ts`) is a permanent 280px-wide container: fixed width, full height, `overflow-y: auto`, right border `var(--app-divider)`, background `var(--app-bg-paper)` (`:15-23`). Reads `navigationConfig.items` directly from `@features/navigation-config` (`:28`) and forwards to `<app-navigation-tree [items]="navItems" />`.
- `LeftNavigationDrawerComponent` (`components/left-navigation-drawer/left-navigation-drawer.component.ts`) wraps the same tree in a `<mat-drawer mode="over">` (`:12-19`), 280px wide, `var(--app-bg-paper)` background (`:22-25`). Accepts `opened = input(false)` (`:31`) and emits `closed = output<void>()` when the Material drawer fires its `(closed)` event (`:15`, `:32`). Also reads `navigationConfig.items` directly (`:33`).
- All three components declare `changeDetection: ChangeDetectionStrategy.OnPush`.
- Component responsive / collapse behavior is **not** implemented in this feature. The app-wide shell in `features/layouts/components/app-layout/app-layout.component.html:5-18` picks either a persistent `<mat-sidenav mode="side">` (desktop) or an overlay `<mat-sidenav mode="over">` (<1200px) and embeds `<app-left-navigation-sidebar />` inside both — the tree itself is identical in both modes.

## Components

| Component | Selector | Inputs / Outputs | Purpose |
|---|---|---|---|
| `NavigationTreeComponent` | `app-navigation-tree` | `items = input.required<NavigationItem[]>()` | Recursive nav-list renderer; flat items become `mat-list-item`, items with `children` become `mat-expansion-panel`. |
| `LeftNavigationSidebarComponent` | `app-left-navigation-sidebar` | none | Permanent 280px sidebar wrapping `NavigationTreeComponent` with `navigationConfig.items`. Used in `app-layout.component.html:7,16`. |
| `LeftNavigationDrawerComponent` | `app-left-navigation-drawer` | `opened = input(false)`, `closed = output<void>()` | Overlay `mat-drawer` variant. Exported but not currently mounted anywhere in the app (see Discrepancies). |

Data source: `@features/navigation-config` (`navigation-config.ts`, `types.ts` — `NavigationItem` / `NavigationConfig`).

Module: `NavigationModule` (`navigation.module.ts`) re-exports the three standalone components for NgModule consumers; current consumers import directly from the barrel (`index.ts`).

## Acceptance Criteria

- [ ] `NavigationTreeComponent` renders one `<mat-nav-list>` containing every entry in `items()`, keyed by `id`.
- [ ] Leaf items render as `<a mat-list-item [routerLink]="item.route">` with `routerLinkActive="active-link"`.
- [ ] Items with `children` render as `<mat-expansion-panel class="nav-group">` with `mat-elevation-z0`, header showing icon + label, body containing a nested `<mat-nav-list>` of child links.
- [ ] The active leaf receives the `active-link` class (`background-color: var(--app-hover-overlay); font-weight: 600`).
- [ ] Item icons render only when `icon` is truthy (`@if (item.icon)` / `@if (child.icon)`).
- [ ] `LeftNavigationSidebarComponent` renders a 280px-wide, full-height, vertically-scrollable `<nav class="sidebar">` with a right divider and paper background, containing the tree built from `navigationConfig.items`.
- [ ] `LeftNavigationDrawerComponent` renders a `<mat-drawer mode="over">` of width 280px whose open state tracks the `opened` input and whose `closed` output fires on the drawer's `(closed)` event.
- [ ] All three components use `ChangeDetectionStrategy.OnPush`.
- [ ] No client-side permission filtering occurs in the tree — every item in `navigationConfig.items` is rendered regardless of `AuthService.permissions()`.

## Discrepancies

- `NavigationItem.permission` is declared in `navigation-config/types.ts:8` and populated on Admin > Users (`navigation-config.ts:27`), but neither the tree component nor the router enforces it. An admin-only link is visible to any authenticated user. Either the metadata should be consumed (e.g. `*appRequirePermission="item.permission"` on the list item) or `permissionGuard('users:read')` should be wired onto the `/admin/users` route — see `features/keycloak-auth/guards/permission.guard.ts:7-18`.
- `LeftNavigationDrawerComponent` is exported from the barrel and registered in `NavigationModule`, but no template in the app references `<app-left-navigation-drawer>`. `AppLayoutComponent` uses `<app-left-navigation-sidebar />` inside its overlay `<mat-sidenav mode="over">` instead (`app-layout.component.html:16`). The drawer component is effectively dead code today.
