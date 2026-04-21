# Navigation — Test Plan

## Left Navigation Sidebar

- [ ] Renders at 280px width with scroll overflow
- [ ] Reads items from `navigationConfig`
- [ ] Uses `ChangeDetectionStrategy.OnPush`

## Left Navigation Drawer

- [ ] Opens/closes via `opened` input binding
- [ ] Emits `closed` output when drawer closes
- [ ] Width is 280px
- [ ] Uses `ChangeDetectionStrategy.OnPush`

## Navigation Tree

- [ ] Flat nav items render as `mat-list-item` with icon and label
- [ ] Grouped items render inside `mat-expansion-panel` with nested `mat-nav-list`
- [ ] Active route item gets `active-link` class (bold text, hover background)
- [ ] Expansion panels use `mat-elevation-z0` (flat appearance)
- [ ] `routerLinkActive` used for active state detection
- [ ] Uses `ChangeDetectionStrategy.OnPush`
