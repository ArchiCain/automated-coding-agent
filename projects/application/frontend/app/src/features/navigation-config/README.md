# navigation-config

Centralized navigation configuration and utilities for the frontend application.

## Purpose

This package provides a single source of truth for application navigation structure, type-safe configuration management, and utility functions for working with hierarchical navigation items. It enables consistent navigation across the application while supporting features like permission-based access control, nested navigation items, and active state detection.

## Usage

```typescript
import {
  navigationConfig,
  findActiveNavItem,
  flattenNavigation,
  NavigationItem,
  NavigationConfig,
} from '@packages/navigation-config';

// Get the current navigation configuration
const navItems = navigationConfig.items;

// Find active item based on current route
const currentPath = '/admin/users';
const activeItem = findActiveNavItem(navItems, currentPath);

// Flatten hierarchy for breadcrumb generation
const allItems = flattenNavigation(navItems);

// Filter navigable items
const navigableItems = getNavigableItems(navItems);
```

## API

| Export | Type | Description |
|--------|------|-------------|
| `navigationConfig` | `NavigationConfig` | Centralized navigation configuration with items and max depth |
| `NavigationConfig` | Interface | Complete navigation configuration structure |
| `NavigationItem` | Interface | Single navigation item with optional children, path, and icon |
| `NavigationItemMetadata` | Interface | Optional metadata for navigation items (description, badge, permissions) |
| `findNavItemByPath` | Function | Find a navigation item by exact path match |
| `findActiveNavItem` | Function | Find the active navigation item based on current route (prefix matching) |
| `isItemOrAncestorActive` | Function | Check if a navigation item or any ancestor is currently active |
| `flattenNavigation` | Function | Convert hierarchical navigation tree to flat array |
| `getNavigationDepth` | Function | Get the nesting depth of a navigation item |
| `getNavigableItems` | Function | Get all items with paths (excluding disabled items) |

## Key Functions

### Finding Active Navigation

```typescript
// Get active item with automatic prefix matching
const activeItem = findActiveNavItem(navigationConfig.items, location.pathname);

// Check if an item should be highlighted (for hierarchical nav)
const isActive = isItemOrAncestorActive(item, activeItem, navigationConfig.items);
```

### Working with Navigation Tree

```typescript
// Get all items as a flat array
const items = flattenNavigation(navigationConfig.items);

// Find specific item by path
const item = findNavItemByPath(navigationConfig.items, '/admin/users');

// Get nesting depth of an item
const depth = getNavigationDepth(item, navigationConfig.items);

// Get all navigable items (with paths, excluding disabled)
const navigableItems = getNavigableItems(navigationConfig.items);
```

## Configuration

The navigation configuration is defined in `navigation-config.ts` and includes these main items:

| Item ID | Path | Description |
|---------|------|-------------|
| `conversational-ai` | `/` | Chat with AI assistants (fullWidth view) |
| `smoke-tests` | `/smoke-tests` | System health checks and diagnostics |
| `user-management` | `/admin/users` | Manage users and permissions (requires `users:read` permission) |

### Navigation Item Structure

Each navigation item supports:

- **id** - Unique identifier for the item
- **label** - Display text in navigation UI
- **path** - Route path (optional, required for navigable items)
- **icon** - MUI IconComponent for visual representation
- **children** - Nested navigation items (supports hierarchical navigation)
- **metadata** - Additional configuration:
  - `description` - Tooltip text
  - `badge` - Badge display text (e.g., "New", "Beta")
  - `disabled` - Disable navigation to this item
  - `fullWidth` - Hide left navigation sidebar on this page
  - `requiredPermission` - Permission required to view this item

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Public API exports |
| `types.ts` | TypeScript interfaces (NavigationItem, NavigationConfig, NavigationItemMetadata) |
| `navigation-config.ts` | Centralized navigation configuration definition |
| `navigation-utils.ts` | Utility functions for working with navigation items |

## Dependencies

- `@mui/material` - Material Design components and type definitions
- `react` - React type definitions for component props
- `keycloak-auth` package - Permission type definitions for permission-based access control

## Integration Example

```typescript
// In your main navigation component
import { navigationConfig, findActiveNavItem } from '@packages/navigation-config';
import { useLocation } from 'react-router-dom';

function NavigationMenu() {
  const { pathname } = useLocation();
  const activeItem = findActiveNavItem(navigationConfig.items, pathname);

  return (
    <nav>
      {navigationConfig.items.map((item) => (
        <NavLink
          key={item.id}
          to={item.path}
          icon={item.icon}
          active={item.id === activeItem?.id}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
```

## Notes

- Root path (`/`) uses exact matching; other paths use prefix matching for active state detection
- Disabled items are excluded from `getNavigableItems` results
- Hierarchical navigation is supported via `children` property, with configurable `maxDepth`
- Permission checks are metadata-driven and should be enforced by consuming components
