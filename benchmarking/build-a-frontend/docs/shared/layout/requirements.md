# Layout Feature

**Feature directory:** `src/app/features/shared/components/layout/`

## Purpose

The app shell — `mat-sidenav-container` with responsive navigation, user info, theme toggle, and logout. Wraps all authenticated pages. The login page does NOT use this layout.

## Component: LayoutComponent

**Selector:** `app-layout`
**Standalone:** yes
**Change detection:** OnPush

### Dependencies
| Service | Methods/signals used |
|---------|---------------------|
| `AuthService` | `user()`, `hasPermission$()`, `logout()` |
| `ThemeService` | `isDark()`, `toggle()` |
| `Router` | Active route detection |
| `BreakpointObserver` | Responsive sidenav mode |

### Behavior

- **Desktop (>960px):** Sidenav in `side` mode (always visible, pushes content)
- **Tablet (600-960px):** Sidenav in `over` mode (overlay, hamburger toggle)
- **Mobile (<600px):** Sidenav in `over` mode (overlay, hamburger toggle)

### Nav Items

| Label | Icon | Route | Visibility |
|-------|------|-------|------------|
| Welcome | `home` | `/home` | Always |
| Users | `people` | `/users` | `hasPermission$('users:read')` |
| Smoke Tests | `monitor_heart` | `/smoke-tests` | Always |

Active route is highlighted with accent color.

### Sidenav Footer

```
��────────────────────┐
│                    │
│  Nav items...      │
│                    │
│  ─────────────     │
│  🌙 Dark Mode [•]  │  ← mat-slide-toggle
│                    │
│  Admin User        │  ← firstName lastName
│  admin@example.com │  ← email, smaller text
│  [Logout]          │  ← mat-button
└────────────────────┘
```

### Layout Structure

```
┌──────────────────────────────────────────────┐
│ mat-toolbar (mobile only — hamburger menu)   │
├────────────┬─────────────────────────────────┤
│ mat-sidenav│ mat-sidenav-content             │
│ width:240px│                                 │
│            │  <router-outlet> (page content) ��
│ Nav items  │  padding: 24px                  │
│            │                                 │
│ Theme tog. │                                 │
│ User info  │                                 │
│ Logout     │                                 │
└────────────┴─────────────────────────────────┘
```

## Acceptance Criteria

- [ ] Sidenav renders with 240px width
- [ ] Desktop: sidenav in `side` mode (always visible)
- [ ] Mobile/tablet: sidenav in `over` mode with hamburger toggle in toolbar
- [ ] Nav items render with icons and labels
- [ ] Active route highlighted with accent color
- [ ] "Users" nav item only visible if user has `users:read` permission
- [ ] Theme toggle switches between light and dark
- [ ] User info shows name and email at bottom of sidenav
- [ ] Logout button clears session and redirects to `/login`
- [ ] Page content renders in `mat-sidenav-content` with 24px padding
