# Layout — Test Plan

## Sidenav Structure

- [ ] Sidenav renders at 240px width
- [ ] Desktop (>960px): sidenav in `side` mode, always visible, pushes content
- [ ] Tablet/Mobile (<960px): sidenav in `over` mode, overlay with hamburger toggle
- [ ] Content renders in `mat-sidenav-content` with 24px padding

## Navigation Items

- [ ] "Welcome" with `home` icon, routes to `/home`, always visible
- [ ] "Users" with `people` icon, routes to `/users`, visible only if `hasPermission$('users:read')`
- [ ] "Smoke Tests" with `monitor_heart` icon, routes to `/smoke-tests`, always visible
- [ ] Active route highlighted with accent color

## Sidenav Footer

- [ ] Theme toggle (`mat-slide-toggle`) switches between light and dark
- [ ] User name displayed (firstName lastName)
- [ ] User email displayed (smaller text)
- [ ] Logout button present

## Responsive Behavior

- [ ] Breakpoint change (resize) dynamically switches sidenav mode
- [ ] Mobile: sidenav closes after navigation
- [ ] Mobile: toolbar shows hamburger menu icon

## Logout

- [ ] Logout button calls `authService.logout()`
- [ ] Session cleared, app redirects to `/login`
