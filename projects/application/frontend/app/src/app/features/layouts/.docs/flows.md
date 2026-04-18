# Layout Feature — Flows

## Flow 1: Desktop Navigation

1. Admin is on `/home` (desktop viewport >960px)
2. Sidenav is visible in `side` mode, content pushed right
3. Nav items visible: Welcome (highlighted), Users, Smoke Tests
4. Admin clicks "Users" nav item
5. Navigated to `/users`, "Users" is now highlighted
6. Sidenav remains visible throughout

## Flow 2: Mobile Navigation

1. User is on `/home` (mobile viewport <600px)
2. Sidenav is hidden, toolbar visible with hamburger icon
3. User taps hamburger icon
4. Sidenav slides over content as overlay
5. User taps "Smoke Tests"
6. Navigated to `/smoke-tests`, sidenav closes automatically

## Flow 3: Permission-Based Nav Visibility

1. Regular user (no `users:read` permission) is authenticated
2. Layout renders sidenav with nav items
3. "Welcome" is visible
4. "Users" is NOT visible (hidden via `hasPermission$('users:read')`)
5. "Smoke Tests" is visible

## Flow 4: Logout

1. User clicks "Logout" at bottom of sidenav
2. `authService.logout()` is called
3. Session cleared, redirected to `/login`
4. Layout component is destroyed (login page doesn't use it)

## Flow 5: Responsive Breakpoint Change

1. User is on desktop (sidenav in `side` mode)
2. User resizes window below 960px
3. Sidenav switches to `over` mode (hides, shows hamburger)
4. Content fills full width
5. User resizes back above 960px
6. Sidenav switches back to `side` mode (visible, pushes content)
