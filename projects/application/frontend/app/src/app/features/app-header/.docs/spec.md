# App Header — Spec

## What it is

The sticky top toolbar that sits above every page of the authenticated app shell. It shows the app's brand title ("RTS AI Platform") and gives the user three controls: a menu button to toggle the side navigation on narrow screens, a theme toggle, and an avatar button that opens a small menu with the current username and a Sign Out action.

## How it behaves

### Toggling the side navigation

On the left of the toolbar is a menu button labeled "Toggle navigation". Clicking it tells the surrounding app layout to open or close the overlay drawer. This only has a visible effect on tablet and mobile widths; on desktop the sidenav is permanent, so the click is effectively a no-op.

### Toggling the theme

To the right of the title, the theme toggle lets the user switch between light and dark modes. It lives in its own feature and is embedded here in the toolbar.

### Opening the avatar menu

The avatar button, at the far right, shows a generic person icon and is labeled "User menu". Clicking it opens a small dropdown. If the user is signed in, the top of the dropdown shows their username. A Sign Out entry with a logout icon is always present at the bottom.

### Signing out

Clicking Sign Out asks the backend to end the session. Regardless of whether the backend call succeeds or fails, the client immediately clears the locally cached user and sends the browser to `/login`.

## Acceptance criteria

- [ ] The toolbar is pinned to the top of the viewport and stays visible as the page scrolls.
- [ ] The toolbar shows a bottom divider and no drop shadow.
- [ ] The brand title reads exactly `RTS AI Platform`.
- [ ] The menu button on the left is labeled "Toggle navigation"; clicking it toggles the app layout's drawer.
- [ ] On desktop widths, clicking the menu button has no visible effect (the sidenav is permanent).
- [ ] The theme toggle and the avatar button both appear on the right, in that order, pushed to the far edge.
- [ ] The avatar button is labeled "User menu" and opens a dropdown when clicked.
- [ ] When the user is signed in, the dropdown shows the current username at the top.
- [ ] When the user is not signed in, the username block is not shown, but the Sign Out entry still appears.
- [ ] Clicking Sign Out ends the session, clears the locally stored user, and navigates to `/login`.
- [ ] Sign Out navigates to `/login` even if the backend logout request fails.

## Known gaps

- The username block only renders when the auth user is non-null; the Sign Out button renders unconditionally, so a signed-out viewer of the header would still see a Sign Out option.
- Logout treats success and error identically: in both cases the cached user is cleared and the browser is redirected to `/login`, so a failed server-side logout is indistinguishable from a successful one to the user.
- The menu toggle button is rendered at all widths, but on desktop the sidenav is permanent and the toggle has no visible effect.

## Code map

Paths are relative to `projects/application/frontend/app/`.

| Concern | File · lines |
|---|---|
| Toolbar layout, sticky positioning, divider, background | `src/app/features/app-header/components/app-header/app-header.component.ts:24-31` |
| Menu button (icon, aria-label, click emits `menuToggle`) | `src/app/features/app-header/components/app-header/app-header.component.ts:14-16,45` |
| Parent wires `menuToggle` to the layout drawer | `src/app/features/layouts/components/app-layout/app-layout.component.html:2` |
| Brand title text and styling | `src/app/features/app-header/components/app-header/app-header.component.ts:17,32-36` |
| Flex spacer between title and right-side controls | `src/app/features/app-header/components/app-header/app-header.component.ts:18,37-39` |
| Theme toggle + avatar menu render order | `src/app/features/app-header/components/app-header/app-header.component.ts:19-20` |
| Avatar button (icon, aria-label, menu trigger) | `src/app/features/app-header/components/avatar-menu/avatar-menu.component.ts:12-14` |
| Username block is conditional on `AuthService.user()` | `src/app/features/app-header/components/avatar-menu/avatar-menu.component.ts:16-20` |
| `User.username` source of truth | `src/app/features/keycloak-auth/types.ts:3` |
| Sign Out item (icon, click handler) | `src/app/features/app-header/components/avatar-menu/avatar-menu.component.ts:21-24` |
| Logout: POST `/auth/logout`, clear user, navigate on success and error | `src/app/features/keycloak-auth/services/auth.service.ts:53-65` |
| OnPush change detection on both components | `src/app/features/app-header/components/app-header/app-header.component.ts:41`, `src/app/features/app-header/components/avatar-menu/avatar-menu.component.ts:37` |
| NgModule wrapper re-exports both standalone components | `src/app/features/app-header/app-header.module.ts:5-8` |
| Public barrel | `src/app/features/app-header/index.ts:1-3` |
| Design tokens used (`--app-bg-paper`, `--app-divider`) | `projects/application/frontend/app/.docs/standards/design.md` |
