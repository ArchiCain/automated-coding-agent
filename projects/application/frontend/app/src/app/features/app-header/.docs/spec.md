# App Header — Requirements

**Feature directory:** `src/app/features/app-header/`

## What It Does

Sticky top toolbar for the application. Contains a hamburger menu toggle, the app title ("RTS AI Platform"), a theme toggle, and an avatar menu for the current user.

## Components

| Component | Selector | Purpose |
|---|---|---|
| `AppHeaderComponent` | `app-header` | Sticky toolbar with menu button, title, theme toggle, avatar menu. Emits `menuToggle` output. |
| `AvatarMenuComponent` | `app-avatar-menu` | Icon button that opens a `mat-menu` showing the logged-in username and a Sign Out action. Uses `AuthService`. |

## Architecture

- `AppHeaderModule` imports and re-exports both components.
- `AppHeaderComponent` delegates navigation drawer toggling to the parent via the `menuToggle` output.
- `AvatarMenuComponent` injects `AuthService` from `@features/keycloak-auth` to display `user()` and call `logout()`.

## Acceptance Criteria

- [ ] Toolbar is sticky at top with `z-index: 1100`
- [ ] Menu button emits `menuToggle` event on click
- [ ] App title displays "RTS AI Platform"
- [ ] Theme toggle and avatar menu render in the right side of the toolbar
- [ ] Avatar menu shows current username when signed in
- [ ] Sign Out button calls `AuthService.logout()`
- [ ] Uses `ChangeDetectionStrategy.OnPush` on all components
