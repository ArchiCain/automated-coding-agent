# Layouts — Test Plan

## Shell Structure

- [ ] `AppLayoutComponent` renders an `<app-header>`, a `<mat-sidenav-container>` with exactly one `<mat-sidenav>` and a `<mat-sidenav-content>`, and a `<router-outlet />` inside the content.
- [ ] Host `.app-layout` is `height: 100vh` with `display: flex; flex-direction: column`.
- [ ] `.layout-container` has `flex: 1; overflow: hidden`.
- [ ] `.main-content` has `padding: 24px` and `overflow-y: auto`.
- [ ] Login route (`/login`) does not mount `AppLayoutComponent`.

## Responsive Sidenav

- [ ] Viewport `>=1200px`: sidenav is `mode="side"`, `opened="true"`, class `.persistent-sidebar`, width `280px`, right border `1px solid var(--app-divider)`.
- [ ] Viewport `768-1199px` and `<=767px`: sidenav is `mode="over"`, class `.drawer-sidebar`, width `280px`, closed by default.
- [ ] Both sidenav variants have `background-color: var(--app-bg-paper)`.
- [ ] Resizing from `<1200px` up to `>=1200px` while the drawer was open results in `drawerOpen() === false` before the persistent sidenav mounts.
- [ ] Resizing from `>=1200px` down to `<1200px` produces a closed overlay sidenav (`drawerOpen() === false`).

## LayoutService

- [ ] `BREAKPOINTS` queries match `min-width: 1200px`, `min-width: 768px and max-width: 1199px`, `max-width: 767px`.
- [ ] Signals `isDesktop`, `isTablet`, `isMobile` reflect the current viewport after each `BreakpointObserver` emission.
- [ ] `showPersistentSidebar()` returns exactly `isDesktop()`.
- [ ] `toggleDrawer()` flips `drawerOpen` between `true` and `false`.
- [ ] `closeDrawer()` sets `drawerOpen` to `false` (idempotent when already closed).
- [ ] Entering the desktop breakpoint sets `drawerOpen` to `false` regardless of its previous value.
- [ ] `ngOnDestroy()` unsubscribes the `BreakpointObserver` subscription (no emissions update signals afterwards).

## Drawer Behavior (mobile / tablet)

- [ ] Clicking the header's menu button fires `menuToggle`, which calls `LayoutService.toggleDrawer()` and opens the drawer.
- [ ] Firing a second `menuToggle` closes the drawer via `toggleDrawer()`.
- [ ] The overlay sidenav's `(closed)` event invokes `LayoutService.closeDrawer()` (backdrop click, Escape).
- [ ] Navigating to a child route does NOT auto-close the drawer (current behavior — no router subscription).

## Integration

- [ ] `AppLayoutComponent` is lazy-loaded from `app.routes.ts` under the empty-path parent guarded by `authGuard`.
- [ ] Child route components render inside `<mat-sidenav-content>` via `<router-outlet />`.
- [ ] `<app-left-navigation-sidebar />` is rendered inside both sidenav variants (persistent and drawer).
