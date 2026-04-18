# Navigation — Requirements

**Feature directory:** `src/app/features/navigation/`

## What It Does

Provides the left-side navigation UI. Includes a permanent sidebar variant and a drawer (overlay) variant, both rendering the same navigation tree. The tree supports flat links and expandable groups with children.

## Components

| Component | Selector | Purpose |
|---|---|---|
| `LeftNavigationSidebarComponent` | `app-left-navigation-sidebar` | Permanent 280px sidebar. Reads items from `navigationConfig`. |
| `LeftNavigationDrawerComponent` | `app-left-navigation-drawer` | Overlay `mat-drawer` (280px). Accepts `opened` input, emits `closed` output. |
| `NavigationTreeComponent` | `app-navigation-tree` | Renders a `NavigationItem[]` as `mat-nav-list`. Items with `children` render as `mat-expansion-panel` groups. Active route highlighted via `routerLinkActive`. |

## Architecture

- Both sidebar and drawer delegate rendering to `NavigationTreeComponent`.
- Navigation items come from `@features/navigation-config` (static config object).
- Active link gets `active-link` class with `background-color: var(--app-hover-overlay)` and bold text.
- Expansion panels use `mat-elevation-z0` for flat appearance.

## Acceptance Criteria

- [ ] Sidebar renders at 280px width with scroll overflow
- [ ] Drawer opens/closes via `opened` input and emits `closed`
- [ ] Flat nav items render as `mat-list-item` with icon and label
- [ ] Grouped items render inside `mat-expansion-panel` with nested `mat-nav-list`
- [ ] Active route item is highlighted
- [ ] All components use `ChangeDetectionStrategy.OnPush`
