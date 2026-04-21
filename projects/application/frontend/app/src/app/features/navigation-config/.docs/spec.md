# Navigation Config — Requirements

**Feature directory:** `src/app/features/navigation-config/`

## What It Does

Defines the navigation structure as a static configuration object and provides utility functions for traversing it. Consumed by the `navigation` feature to render the sidebar/drawer.

## Exports

| Export | Type | Purpose |
|---|---|---|
| `navigationConfig` | Const object | Static `NavigationConfig` with the app's nav items (Smoke Tests, Chat, Admin > Users). |
| `NavigationItem` | Interface | Shape of a nav item: `id`, `label`, `icon?`, `route?`, `children?`, `permission?`, `badge?`. |
| `NavigationConfig` | Interface | `{ items: NavigationItem[] }` |
| `flattenNavigation()` | Function | Recursively flattens nested `NavigationItem[]` into a flat array. |
| `findActiveNavItem()` | Function | Finds the nav item matching a given route string. |
| `findParentNavItem()` | Function | Finds the parent item containing a child with a given `id`. |

## Current Navigation Structure

```
- Smoke Tests  (/smoke-tests)
- Chat         (/chat)
- Admin
  - Users      (/admin/users, permission: users:read)
```

## Acceptance Criteria

- [ ] `navigationConfig` contains all app routes
- [ ] `NavigationItem` supports optional `children` for nested groups
- [ ] `NavigationItem` supports optional `permission` for access control
- [ ] `flattenNavigation()` returns all items including nested children
- [ ] `findActiveNavItem()` returns the item matching a route or `null`
- [ ] `findParentNavItem()` returns the parent of a child by `id` or `null`
