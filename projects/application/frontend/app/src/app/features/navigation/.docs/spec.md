# Navigation — Spec

## What it is

The left-hand navigation for the app. It shows a list of pages the signed-in user can jump to, grouped into collapsible sections where appropriate, and highlights whichever page is currently open. The list is driven by a static configuration owned by a sibling feature; this feature just renders it.

## How it behaves

### Rendering the nav list

On load, the nav reads the configured list of navigation items and renders them as a single vertical list. Each entry is either a leaf link (a page the user can navigate to) or a group (a parent with child links). Groups show a header with an optional icon plus a label; leaves show an optional leading icon plus a label. Entries without an icon just show text.

### Clicking a link

Clicking a leaf navigates the app to that page's route. Group headers themselves do not navigate — they only open or close the group. To reach a page inside a group, the user clicks one of the child links.

### Expanding and collapsing a group

A group starts collapsed. Clicking its header expands it and reveals the child links in a nested list beneath it; clicking the header again collapses it. Groups look flat (no drop shadow) so they sit flush with the surrounding list.

### Highlighting the active route

Whichever leaf matches the current URL is highlighted — it gets a subtle background tint and heavier font weight — so the user can see where they are at a glance. When the route changes, the highlight moves to the new matching leaf.

### Where the nav lives in the app shell

The nav is mounted inside the app's layout as a permanent 280px-wide column down the left side, with a right divider and a paper-colored background, and it scrolls vertically if the list is taller than the viewport. The layout shell (not this feature) chooses between a persistent side panel on desktop and an overlay panel on narrow screens; the list rendered inside is identical in both.

## Acceptance criteria

- [ ] The nav renders one list containing every configured item, in order.
- [ ] A leaf item renders as a clickable link that navigates to its route.
- [ ] A group item renders as a collapsible section with a header and a nested list of child links.
- [ ] Group headers are not themselves navigable — clicking one only toggles the group open/closed.
- [ ] Each item's icon renders only when the item has one; items without an icon show just the label.
- [ ] The leaf matching the current route is visually highlighted (tinted background, heavier font weight).
- [ ] The highlight follows route changes.
- [ ] The sidebar column is 280px wide, full height, scrolls vertically when overflowed, has a right divider, and uses the paper background.

## Known gaps

- Per-item permission metadata is not enforced. Configuration can attach a `permission` string to an item (for example, `users:read` on Admin > Users), but the nav renders every item unconditionally and the corresponding route has no permission guard — so an admin-only link is visible and reachable for any authenticated user. Either the nav needs to consume the permission metadata (filtering or hiding items the user lacks) or the route needs a guard wired up.
- The overlay drawer variant of the nav is exported and registered by the feature's module, but no template in the app references it. The app shell uses the permanent sidebar inside its overlay sidenav on narrow screens instead, so the drawer component is dead code today.

## Code map

Paths are relative to `projects/application/frontend/app/`.

| Concern | File · lines |
|---|---|
| Tree component accepts `items` input and renders a single `<mat-nav-list>` | `src/app/features/navigation/components/navigation-tree/navigation-tree.component.ts:13,66` |
| Group rendering (expansion panel, flat elevation, header icon + label, nested list) | `navigation-tree.component.ts:15-35` |
| Leaf rendering (`mat-list-item` + `routerLink` + optional icon) | `navigation-tree.component.ts:37-42` |
| `@for` tracked by `item.id` / `child.id` | `navigation-tree.component.ts:14,26` |
| Active-leaf highlight (`active-link` class, `--app-hover-overlay`, font-weight 600) | `navigation-tree.component.ts:57-60` |
| Permanent 280px sidebar shell (full height, scroll, right divider, paper bg) | `src/app/features/navigation/components/left-navigation-sidebar/left-navigation-sidebar.component.ts:15-23,28` |
| Overlay drawer variant (`mat-drawer mode="over"`, 280px, `opened`/`closed`) | `src/app/features/navigation/components/left-navigation-drawer/left-navigation-drawer.component.ts:12-19,22-25,31-33` |
| All three components declare `ChangeDetectionStrategy.OnPush` | `navigation-tree.component.ts`, `left-navigation-sidebar.component.ts`, `left-navigation-drawer.component.ts` |
| Data source (static tree, types) | `src/app/features/navigation-config/navigation-config.ts`, `src/app/features/navigation-config/types.ts` |
| Permission field declared on items | `src/app/features/navigation-config/types.ts:8` |
| `users:read` set on Admin > Users (unused) | `src/app/features/navigation-config/navigation-config.ts:27` |
| App shell mounts the sidebar in both desktop and narrow layouts | `src/app/features/layouts/components/app-layout/app-layout.component.html:5-18` |
| Sidenav open/close state (owned by layouts, not this feature) | `src/app/features/layouts/services/layout.service.ts` |
| Module re-exports the three standalone components | `src/app/features/navigation/navigation.module.ts` |
| Available permission guard (not wired onto `/admin/users`) | `src/app/features/keycloak-auth/guards/permission.guard.ts:7-18` |
| Router leaves `/admin/users` unguarded | `src/app/app.routes.ts` |
