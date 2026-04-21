# Layouts — Spec

## What it is

The page shell that everything signed-in lives inside — a sticky toolbar on top, a navigation drawer on the side, and the routed content in the middle. Every protected route renders inside this shell; the login page is the only route that opts out.

## How it behaves

### Entering a protected route for the first time

When the user lands on any authenticated route, the shell mounts with the toolbar pinned to the top of the viewport and the content area filling the rest of the screen. The shell itself doesn't scroll — only the content area does. On a desktop-sized window the navigation drawer is already visible on the left and pushes the content over to make room for it. On a narrower window the drawer starts hidden and the content uses the full width.

### Resizing the viewport

The shell watches the viewport size and swaps the drawer between two modes. Above the desktop threshold the drawer is persistent: always open, sitting alongside the content. Below that threshold the drawer becomes an overlay that floats on top of the content when opened. When the viewport grows from a narrow size back up to desktop, any open overlay drawer is forced closed so it can't linger into the persistent layout.

### Opening and closing the drawer on narrower viewports

On tablet and mobile sizes the toolbar shows a menu button. Tapping it toggles the overlay drawer open or closed. The drawer can also close itself when the user taps outside it (its own close event feeds back into the shared open state). Clicking a link inside the drawer does not close it.

### Switching routes

Navigating between authenticated routes swaps what's inside the content area but leaves the shell alone — the toolbar and drawer stay exactly where they were. Navigating to the login route unmounts the shell entirely; that page renders on its own.

## Acceptance criteria

- [ ] Every authenticated route renders inside the shell; the login route does not.
- [ ] The shell fills the full viewport height and only the content area scrolls.
- [ ] The toolbar sits at the top of the shell and stays visible while the content scrolls.
- [ ] On viewports at or above the desktop threshold, the drawer is persistent and always open alongside the content.
- [ ] On viewports below the desktop threshold, the drawer is an overlay that starts closed.
- [ ] The drawer is 280px wide in both modes; the persistent variant shows a right-edge divider.
- [ ] The toolbar's menu button toggles the overlay drawer open and closed.
- [ ] The overlay drawer's own close event sets the shared open state back to closed.
- [ ] Resizing from a narrow viewport up into desktop force-closes the overlay drawer.
- [ ] The content area has 24px of padding and hosts the routed view.
- [ ] The viewport-size subscription is cleaned up when the shell is destroyed.

## Known gaps

- The drawer does not auto-close when the user navigates to a new route — there's no router subscription wired in, so on narrow viewports the drawer stays open across navigations until the user dismisses it.
- `LayoutBreakpoints` is exported from the feature's public barrel but nothing in the feature uses it. It exists only for potential downstream consumers.
- Older documentation described the breakpoints as 240px / 960px. Those numbers are obsolete — the drawer is 280px wide and the desktop threshold is 1200px.

## Code map

Paths are relative to `projects/application/frontend/app/`.

| Concern | File · lines |
|---|---|
| Shell component (toolbar + sidenav container + content) | `src/app/features/layouts/components/app-layout/app-layout.component.ts:10-24` |
| Shell template (persistent vs. overlay drawer branching) | `src/app/features/layouts/components/app-layout/app-layout.component.html:1-24` |
| Shell fills viewport; only content scrolls | `src/app/features/layouts/components/app-layout/app-layout.component.scss:1-10` |
| Drawer width (280px) and persistent-variant right border | `src/app/features/layouts/components/app-layout/app-layout.component.scss:12-21` |
| Content padding (24px) and scroll | `src/app/features/layouts/components/app-layout/app-layout.component.scss:23-26` |
| Mounts under the empty-path route with `authGuard` | `src/app/app.routes.ts:12-46` |
| Viewport-size signals + drawer open state | `src/app/features/layouts/services/layout.service.ts:11-40` |
| Breakpoint range definitions | `src/app/features/layouts/services/layout.service.ts:5-9` |
| Computed flag that picks persistent vs. overlay | `src/app/features/layouts/services/layout.service.ts:25` |
| Force-close drawer on desktop transition | `src/app/features/layouts/services/layout.service.ts:36-38` |
| Subscription cleanup on destroy | `src/app/features/layouts/services/layout.service.ts:50-52` |
| Toolbar menu button wired to drawer toggle | `src/app/features/layouts/components/app-layout/app-layout.component.html:2` |
| `LayoutBreakpoints` type (exported, unused internally) | `src/app/features/layouts/types.ts:1-5` |
| Module (thin re-export wrapper) | `src/app/features/layouts/layouts.module.ts:1-8` |
| Public barrel | `src/app/features/layouts/index.ts:1-4` |

### Related features

The toolbar (brand, theme toggle, avatar menu) is the `app-header` feature. The drawer's contents (the nav tree) is the `navigation` feature. The auth gate on the shell's parent route comes from the `keycloak-auth` feature.
