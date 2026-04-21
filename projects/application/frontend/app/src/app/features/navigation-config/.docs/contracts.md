# Navigation Config — Contracts

This feature crosses a feature boundary (not a network boundary). It publishes TypeScript types and a static data constant consumed by the sibling `navigation` feature. No HTTP, no WebSocket, no DTOs.

## Shared Types

Source: `types.ts`.

```typescript
/** A single navigation entry. May contain `children` for nested groups. */
export interface NavigationItem {
  id: string;             // stable key; used by @for track in NavigationTreeComponent
  label: string;          // visible text
  icon?: string;          // Material Symbols ligature (e.g. 'chat', 'people')
  route?: string;         // Angular router path; absent for group parents
  children?: NavigationItem[]; // nested group
  permission?: string;    // metadata; NOT enforced (see spec.md Discrepancies)
  badge?: string;         // reserved; not rendered anywhere today
}

/** Top-level navigation configuration containing all nav items. */
export interface NavigationConfig {
  items: NavigationItem[];
}
```

## Exported Constant

Source: `navigation-config.ts:3-32`.

```typescript
export const navigationConfig: NavigationConfig = {
  items: [
    { id: 'smoke-tests', label: 'Smoke Tests', icon: 'science', route: '/smoke-tests' },
    { id: 'chat',        label: 'Chat',        icon: 'chat',    route: '/chat' },
    {
      id: 'admin',
      label: 'Admin',
      icon: 'admin_panel_settings',
      children: [
        { id: 'users', label: 'Users', icon: 'people', route: '/admin/users', permission: 'users:read' },
      ],
    },
  ],
};
```

## Utility Function Signatures

Source: `navigation-utils.ts`.

```typescript
export function flattenNavigation(items: NavigationItem[]): NavigationItem[];
export function findActiveNavItem(items: NavigationItem[], currentRoute: string): NavigationItem | null;
export function findParentNavItem(items: NavigationItem[], childId: string): NavigationItem | null;
```

Semantics:
- `flattenNavigation` — pre-order DFS; parent appears before its descendants.
- `findActiveNavItem` — exact string equality on `route`; returns first match from the flattened list.
- `findParentNavItem` — returns the nearest ancestor item whose `children` array contains `childId`.

## Consumers

| Consumer | Import | Uses |
|---|---|---|
| `LeftNavigationSidebarComponent` | `@features/navigation-config` (`left-navigation-sidebar.component.ts:3`) | `navigationConfig.items` |
| `LeftNavigationDrawerComponent` | `@features/navigation-config` (`left-navigation-drawer.component.ts:4`) | `navigationConfig.items` |

The utility functions have no external callers today (see `spec.md` Discrepancies).
