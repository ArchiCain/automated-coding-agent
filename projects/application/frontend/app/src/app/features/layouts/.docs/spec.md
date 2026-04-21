# Layouts — Spec

## Purpose

The authenticated app shell. `AppLayoutComponent` wraps every protected route with a sticky header, a responsive left sidenav, and a scrollable content area that hosts a `<router-outlet />`. `LayoutService` owns the viewport-breakpoint signals and the mobile/tablet drawer open state so that the header's menu button, the sidenav, and the main content stay in sync. The login page is the only route that does NOT use this layout.

## Behavior

- `AppLayoutComponent` is mounted under the empty-path route with `canActivate: [authGuard]` and all authenticated pages render inside its `<router-outlet />` (`src/app/app.routes.ts:12-46`).
- Top-level vertical structure: sticky `<app-header>` on top, `<mat-sidenav-container>` filling the remaining viewport height (`src/app/features/layouts/components/app-layout/app-layout.component.html:1-24`, `app-layout.component.scss:1-10`).
- The host element is `height: 100vh` with `display: flex; flex-direction: column`, and the sidenav container takes `flex: 1; overflow: hidden` so only the content area scrolls (`app-layout.component.scss:1-10`).
- Sidenav rendering is chosen from `LayoutService.showPersistentSidebar()` (true only on desktop) (`layout.service.ts:25`, `app-layout.component.html:5-18`):
  - Desktop: `<mat-sidenav mode="side" [opened]="true">` — always visible, pushes content (`app-layout.component.html:6-8`).
  - Tablet / mobile: `<mat-sidenav mode="over" [opened]="layout.drawerOpen()" (closed)="layout.closeDrawer()">` — overlay drawer controlled by the header menu button (`app-layout.component.html:10-17`).
- Both sidenav modes render `<app-left-navigation-sidebar />` (the nav tree lives in the `navigation` feature) and have width `280px` with `background-color: var(--app-bg-paper)`; the persistent variant adds `border-right: 1px solid var(--app-divider)` (`app-layout.component.scss:12-21`).
- Main content (`<mat-sidenav-content class="main-content">`) applies `padding: 24px` and `overflow-y: auto` (`app-layout.component.scss:23-26`).
- The header's `(menuToggle)` output is bound to `LayoutService.toggleDrawer()` (`app-layout.component.html:2`). The header itself owns brand, theme toggle, and avatar menu — see the `app-header` feature.
- `LayoutService` is `providedIn: 'root'` and observes three CDK breakpoints via `BreakpointObserver` (`layout.service.ts:11-40`). See the `Breakpoints` section below for the ranges — they match `projects/application/frontend/app/.docs/standards/design.md`.
- When the viewport transitions into desktop, `LayoutService` forces `drawerOpen` to `false` so the overlay drawer can never leak into the persistent-sidebar layout (`layout.service.ts:36-38`).
- `LayoutService.ngOnDestroy()` unsubscribes the `BreakpointObserver` subscription (`layout.service.ts:50-52`).
- No route guards, resolvers, or route-based layout switching live in this feature. `authGuard` (from `keycloak-auth`) is the only gate on the layout's parent route.

## Components / Services

| Name | File | Role |
|---|---|---|
| `AppLayoutComponent` | `components/app-layout/app-layout.component.ts:10-24` | Standalone shell. Imports `RouterOutlet`, `MatSidenavModule`, `AppHeaderComponent`, `LeftNavigationSidebarComponent`. `OnPush`. Injects `LayoutService` as `layout` for template use. |
| `LayoutService` | `services/layout.service.ts:11-53` | Root singleton. Signals: `isDesktop`, `isTablet`, `isMobile`, `drawerOpen`, `showPersistentSidebar` (computed). Methods: `toggleDrawer()`, `closeDrawer()`. |
| `LayoutBreakpoints` | `types.ts:1-5` | Exported interface `{ desktop: boolean; tablet: boolean; mobile: boolean }`. Currently unused in the feature itself; exported for downstream consumers. |
| `LayoutsModule` | `layouts.module.ts:1-8` | Thin NgModule that imports and re-exports `AppLayoutComponent` for module-style consumers. |

Public barrel (`index.ts:1-4`): `LayoutsModule`, `AppLayoutComponent`, `LayoutService`, `LayoutBreakpoints`.

## Breakpoints

Ranges are defined in `layout.service.ts:5-9` and mirror `standards/design.md`:

| Name | Range | Sidenav behavior |
|---|---|---|
| Desktop | `min-width: 1200px` | Persistent `mode="side"`, always open |
| Tablet | `768–1199px` | Overlay `mode="over"`, closed by default, opened by menu button |
| Mobile | `max-width: 767px` | Overlay `mode="over"`, closed by default, opened by menu button |

## Acceptance Criteria

- [ ] `AppLayoutComponent` renders `<app-header>`, a `<mat-sidenav-container>` with a sidenav and `<mat-sidenav-content>`, and the content hosts `<router-outlet />`.
- [ ] On viewports `>=1200px` the sidenav renders with `mode="side"` and `opened="true"` (persistent).
- [ ] On viewports `<1200px` the sidenav renders with `mode="over"` and opens/closes via `LayoutService.drawerOpen()`.
- [ ] Sidenav width is `280px` in both modes; persistent variant shows a right border using `--app-divider`.
- [ ] Main content has `padding: 24px` and is the only scrollable area (`overflow-y: auto`); the shell itself is `height: 100vh`.
- [ ] The header's `menuToggle` output toggles `LayoutService.drawerOpen`.
- [ ] The overlay drawer's `(closed)` event sets `drawerOpen` to `false`.
- [ ] Resizing from tablet/mobile up to desktop force-closes the drawer (`drawerOpen` becomes `false`).
- [ ] `LayoutService` disposes its `BreakpointObserver` subscription on destroy.
- [ ] The login route (`/login`) does NOT render `AppLayoutComponent`.
