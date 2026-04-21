# Layouts — Flows

## Flow 1: Route-based layout selection

1. User navigates to any path under the application.
2. The router matches against `app.routes.ts:5-47`:
   - `/login` loads `LoginPage` directly — no layout shell (`app.routes.ts:6-10`).
   - Any other path matches the empty-path parent, which runs `canActivate: [authGuard]` and lazy-loads `AppLayoutComponent` (`app.routes.ts:12-17`).
3. If `authGuard` returns `false` the user is redirected to `/login` and `AppLayoutComponent` is never instantiated. Otherwise the layout mounts and the matched child route renders into its `<router-outlet />` (`app-layout.component.html:20-22`).
4. `AppLayoutComponent` injects `LayoutService` (root singleton) — the service was already constructed on first injection and has been observing breakpoints since then (`layout.service.ts:27-39`).

## Flow 2: Initial layout selection by viewport

1. `LayoutService` constructor subscribes to `BreakpointObserver.observe([desktop, tablet, mobile])` with queries `min-width: 1200px`, `768-1199px`, `max-width: 767px` (`layout.service.ts:28-30`).
2. The first synchronous emission populates `_isDesktop`, `_isTablet`, `_isMobile` signals (`layout.service.ts:31-33`).
3. `showPersistentSidebar = computed(() => _isDesktop())` is read by the template (`layout.service.ts:25`).
4. Template branches via `@if (layout.showPersistentSidebar())` (`app-layout.component.html:5-18`):
   - True: render `<mat-sidenav mode="side" [opened]="true">`.
   - False: render `<mat-sidenav mode="over" [opened]="layout.drawerOpen()" (closed)="layout.closeDrawer()">`.
5. Both branches render `<app-left-navigation-sidebar />` inside the sidenav.

## Flow 3: Mobile/tablet drawer open

1. Viewport is `<1200px`; template is showing the overlay sidenav with `drawerOpen()` returning `false`, so the drawer is closed.
2. User taps the menu button in `<app-header>`. The header emits `menuToggle` (`app-header.component.ts:45`).
3. `(menuToggle)="layout.toggleDrawer()"` on `<app-header>` calls `LayoutService.toggleDrawer()` (`app-layout.component.html:2`, `layout.service.ts:42-44`).
4. `toggleDrawer()` flips `_drawerOpen` to `true`. The signal update propagates to the bound `[opened]="layout.drawerOpen()"` input and the Material sidenav animates in as an overlay.

## Flow 4: Mobile/tablet drawer close

There are two close paths:

1. User taps the scrim/backdrop or presses Escape. Material fires `(closed)` on the sidenav, which invokes `LayoutService.closeDrawer()` (`app-layout.component.html:13`, `layout.service.ts:46-48`). `_drawerOpen` is set to `false`.
2. User presses the menu button again. `toggleDrawer()` flips the signal back to `false`.

Child route navigation does NOT auto-close the drawer — there is no navigation listener in `LayoutService` or `AppLayoutComponent`. Closing relies on the user or on a desktop breakpoint transition (Flow 5).

## Flow 5: Responsive breakpoint change

1. User resizes the browser so the viewport crosses a breakpoint.
2. `BreakpointObserver` emits a new result; the subscription updates `_isDesktop`, `_isTablet`, `_isMobile` (`layout.service.ts:31-33`).
3. If the new state is desktop, `_drawerOpen` is force-set to `false` to guarantee the next persistent-sidebar render is clean (`layout.service.ts:36-38`).
4. `showPersistentSidebar()` recomputes. `@if` in the template re-evaluates:
   - Entered desktop: persistent `<mat-sidenav mode="side" [opened]="true">` replaces the overlay variant.
   - Left desktop: overlay `<mat-sidenav mode="over">` replaces the persistent variant; its `[opened]` binding reflects `drawerOpen()` (false immediately after the transition).
5. Content in `<mat-sidenav-content>` reflows. Only the content area scrolls (`overflow-y: auto` on `.main-content`).

## Flow 6: Service teardown

1. The Angular platform tears down (full app destruction — `LayoutService` is `providedIn: 'root'` so it is not destroyed on route change).
2. `LayoutService.ngOnDestroy()` runs and unsubscribes the stored `BreakpointObserver` subscription (`layout.service.ts:50-52`).
