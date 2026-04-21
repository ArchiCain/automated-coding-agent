# Navigation Config — Test Plan

## Static Configuration

- [ ] `navigationConfig` contains Smoke Tests (/smoke-tests), Chat (/chat), Admin > Users (/admin/users)
- [ ] Admin > Users has `permission: 'users:read'`
- [ ] `NavigationItem` supports optional `children` for nested groups
- [ ] `NavigationItem` supports optional `permission`, `badge`, `icon`, `route`

## Utility Functions

- [ ] `flattenNavigation()` returns all items including nested children in flat array
- [ ] `findActiveNavItem(route)` returns matching item or null
- [ ] `findActiveNavItem()` returns null for non-existent route
- [ ] `findParentNavItem(id)` returns parent containing child with given id
- [ ] `findParentNavItem(id)` returns null for top-level items or non-existent id
