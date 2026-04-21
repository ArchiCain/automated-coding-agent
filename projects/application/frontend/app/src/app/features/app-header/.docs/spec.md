# App Header — Spec

**Feature directory:** `src/app/features/app-header/`

## Purpose

Sticky top toolbar for the authenticated application shell. Provides the drawer toggle (mobile/tablet), the app brand title, a theme toggle, and a user avatar menu with a Sign Out action. Rendered once by `AppLayoutComponent` above the sidenav and router outlet (`features/layouts/components/app-layout/app-layout.component.html:2`).

## Behavior

- Toolbar renders as a `mat-toolbar` with `position: sticky; top: 0; z-index: 1100`, `background-color: var(--app-bg-paper)`, a bottom divider, and no box-shadow (`components/app-header/app-header.component.ts:24-31`).
- Left side: `mat-icon-button` with the `menu` icon and `aria-label="Toggle navigation"`. Clicking it emits the `menuToggle` output (`app-header.component.ts:14-16,45`). The parent `AppLayoutComponent` wires this to `LayoutService.toggleDrawer()` (`features/layouts/components/app-layout/app-layout.component.html:2`) — the menu button only affects the overlay drawer on tablet/mobile.
- Brand title reads `RTS AI Platform`, rendered as a `span.app-title` with `margin-left: 8px; font-weight: 600; font-size: 1.1rem` (`app-header.component.ts:17,32-36`).
- A flex spacer (`.spacer { flex: 1 }`) pushes the theme toggle and avatar menu to the right edge (`app-header.component.ts:18,37-39`).
- Right side renders `<app-theme-toggle />` then `<app-avatar-menu />` in that order (`app-header.component.ts:19-20`).
- `AvatarMenuComponent` shows a `mat-icon-button` with the `account_circle` icon and `aria-label="User menu"` that triggers a `mat-menu` via `matMenuTriggerFor` (`components/avatar-menu/avatar-menu.component.ts:12-14`).
- When `AuthService.user()` is non-null, the menu renders a `.user-info` header with the `username` from `User.username` (`avatar-menu.component.ts:16-20`; `features/keycloak-auth/types.ts:3`). When `user()` is null the user-info block is omitted but the Sign Out button still renders.
- The "Sign Out" `mat-menu-item` uses the `logout` icon and calls `AuthService.logout()` on click (`avatar-menu.component.ts:21-24`).
- `AuthService.logout()` sends `POST ${backendUrl}/auth/logout` with `withCredentials: true`; on complete or error it clears `_user` and navigates to `/login` (`features/keycloak-auth/services/auth.service.ts:53-65`).
- All three components use `ChangeDetectionStrategy.OnPush` (`app-header.component.ts:41`, `avatar-menu.component.ts:37`). Both components are standalone with inline templates and inline styles.
- `AppHeaderModule` imports and re-exports both standalone components for legacy NgModule consumers (`app-header.module.ts:5-8`). The public barrel exports `AppHeaderModule`, `AppHeaderComponent`, and `AvatarMenuComponent` (`index.ts:1-3`).

## Components

| Component | Selector | Inputs / Outputs | Dependencies |
|---|---|---|---|
| `AppHeaderComponent` | `app-header` | `menuToggle: output<void>()` | `MatToolbarModule`, `MatIconModule`, `MatButtonModule`, `ThemeToggleComponent` (`@features/theme`), `AvatarMenuComponent` |
| `AvatarMenuComponent` | `app-avatar-menu` | — | `MatButtonModule`, `MatIconModule`, `MatMenuModule`, `AuthService` (`@features/keycloak-auth`) |

## Design References

Colors and tokens used (`--app-bg-paper`, `--app-divider`) are defined in the project-level design spec — see `projects/application/frontend/app/.docs/standards/design.md` (Backgrounds and Borders sections). The toolbar's sticky placement and z-index match the "Authenticated shell" diagram in that document.

## Acceptance Criteria

- [ ] `mat-toolbar.app-header` is `position: sticky; top: 0; z-index: 1100` with `background-color: var(--app-bg-paper)` and a `1px solid var(--app-divider)` bottom border.
- [ ] Menu `mat-icon-button` has `aria-label="Toggle navigation"` and the `menu` Material icon, and its click emits the `menuToggle` output.
- [ ] The brand title text is exactly `RTS AI Platform`.
- [ ] The theme toggle and avatar menu render, in that order, on the right side of the toolbar (flex spacer between title and controls).
- [ ] The avatar button has `aria-label="User menu"`, the `account_circle` icon, and opens a `mat-menu`.
- [ ] When `AuthService.user()` is non-null, the menu displays `user().username` inside a `.user-info` header; when null, no user-info block is shown.
- [ ] The Sign Out `mat-menu-item` has the `logout` icon and invokes `AuthService.logout()` on click.
- [ ] All three components (`AppHeaderComponent`, `AvatarMenuComponent`, and the consumed `ThemeToggleComponent`) declare `ChangeDetectionStrategy.OnPush`.
- [ ] `AppHeaderModule` exports both `AppHeaderComponent` and `AvatarMenuComponent`; the barrel `index.ts` exposes all three symbols.
