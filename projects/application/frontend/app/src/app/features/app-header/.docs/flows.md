# App Header — Flows

The header itself is largely presentational. Two interactions are worth tracing end-to-end because they leave the feature boundary.

## Flow 1: Menu toggle (open/close drawer)

1. User clicks the left-side `mat-icon-button` with the `menu` icon (`components/app-header/app-header.component.ts:14`).
2. `AppHeaderComponent.menuToggle` emits `void` (`app-header.component.ts:14,45`).
3. `AppLayoutComponent` template binding `(menuToggle)="layout.toggleDrawer()"` invokes `LayoutService.toggleDrawer()` (`features/layouts/components/app-layout/app-layout.component.html:2`).
4. `LayoutService` flips its drawer-open signal; the `mat-sidenav` (`over` mode on tablet/mobile) reacts and slides in/out. On desktop the sidenav is always open in `side` mode, so the click is a no-op for layout but still fires the toggle signal.

## Flow 2: Sign out

1. User clicks the `mat-icon-button` with the `account_circle` icon (`components/avatar-menu/avatar-menu.component.ts:12-14`).
2. The attached `mat-menu` opens. If `AuthService.user()` is non-null, the menu renders `.user-info` showing `user().username` above the Sign Out item (`avatar-menu.component.ts:16-20`).
3. User clicks the `Sign Out` `mat-menu-item` (`avatar-menu.component.ts:21-24`).
4. The click handler invokes `AuthService.logout()` (`features/keycloak-auth/services/auth.service.ts:53-65`).
5. `AuthService.logout()` sends `POST ${AppConfigService.backendUrl}/auth/logout` with an empty body and `withCredentials: true` (`auth.service.ts:54`).
6. On the Observable's `complete` callback, `_user` is set to `null` and the router navigates to `/login` (`auth.service.ts:56-59`).
7. On error, the same cleanup runs — `_user` is cleared and the user is still navigated to `/login` (`auth.service.ts:60-63`), so network failure does not strand the user in an authenticated shell.
8. `authGuard` on the protected route tree sees `isAuthenticated() === false` on any subsequent navigation attempt and redirects to `/login` (`features/keycloak-auth/guards/auth.guard.ts`).

## Flow 3: Theme toggle

1. User clicks the `<app-theme-toggle />` icon button inside the header (`components/app-header/app-header.component.ts:19`).
2. Handling is owned by `ThemeToggleComponent` (`features/theme/components/theme-toggle/theme-toggle.component.ts:11-13`) and `ThemeService` — the header does not participate beyond hosting the component. See the `theme` feature docs for the full flow.
