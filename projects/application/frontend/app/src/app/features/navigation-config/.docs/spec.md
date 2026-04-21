# Navigation Config — Spec

**Feature directory:** `src/app/features/navigation-config/`

## Purpose

Single source of truth for the app's left-hand navigation data. Exports a static `navigationConfig: NavigationConfig` describing the sidebar tree (Smoke Tests, Chat, Admin > Users), the `NavigationItem` / `NavigationConfig` TypeScript types, and pure utility helpers for traversing the tree. Consumed by the sibling `navigation` feature, which handles rendering (`features/navigation/components/left-navigation-sidebar/left-navigation-sidebar.component.ts:28`, `features/navigation/components/left-navigation-drawer/left-navigation-drawer.component.ts:33`). This feature owns data only — no components, no DI, no runtime behavior beyond pure functions.

## Behavior

- `navigationConfig` is an exported `const` of type `NavigationConfig` built at module load — no factory, no service, no injection (`navigation-config.ts:3-32`).
- `NavigationItem` (`types.ts:2-10`) fields: `id` (required), `label` (required), `icon?` (Material icon ligature), `route?` (Angular router path), `children?: NavigationItem[]` (nested groups), `permission?: string` (metadata only), `badge?: string`.
- `NavigationConfig` (`types.ts:13-15`) is `{ items: NavigationItem[] }`.
- An item with `children` is a group (no `route`); an item with `route` is a leaf. These are not enforced by TypeScript — both fields are optional — but the current config follows the pattern.
- `permission` on a `NavigationItem` is metadata only. It is not consumed by the renderer (`navigation/components/navigation-tree/navigation-tree.component.ts`) and not consumed by the router (`app.routes.ts`). The Admin > Users item carries `permission: 'users:read'` (`navigation-config.ts:27`) but `/admin/users` has no `permissionGuard` and the nav item is always rendered. See Discrepancies.
- `flattenNavigation(items)` — recursive DFS pre-order: pushes each item, then recurses into `item.children` (`navigation-utils.ts:4-13`). Parents appear before their descendants.
- `findActiveNavItem(items, currentRoute)` — flattens then returns the first item whose `route === currentRoute`, else `null`. Exact string match; no path-prefix, no query-string, no trailing-slash normalization (`navigation-utils.ts:16-22`).
- `findParentNavItem(items, childId)` — recursive DFS; returns the nearest ancestor whose `children` contains an entry with `id === childId`, else `null` (`navigation-utils.ts:25-39`).
- `NavigationConfigModule` (`navigation-config.module.ts:3-4`) is an empty `@NgModule({})` kept for NgModule-style consumers; holds no declarations or providers.

## Exports

| Export | Kind | Source | Purpose |
|---|---|---|---|
| `navigationConfig` | const | `navigation-config.ts:3` | The populated `NavigationConfig` instance. |
| `NavigationItem` | interface | `types.ts:2` | Single nav entry shape. |
| `NavigationConfig` | interface | `types.ts:13` | `{ items: NavigationItem[] }`. |
| `flattenNavigation` | function | `navigation-utils.ts:4` | Recursively flatten nested items into a single array (pre-order). |
| `findActiveNavItem` | function | `navigation-utils.ts:16` | Exact-match lookup by `route`, or `null`. |
| `findParentNavItem` | function | `navigation-utils.ts:25` | Lookup ancestor group by child `id`, or `null`. |
| `NavigationConfigModule` | NgModule | `navigation-config.module.ts:3` | Empty module barrel for NgModule consumers. |

Barrel: `index.ts:1-4`.

## Navigation Items

Source: `navigation-config.ts:4-31`.

| id | label | icon | route | permission | children |
|---|---|---|---|---|---|
| `smoke-tests` | Smoke Tests | `science` | `/smoke-tests` | — | — |
| `chat` | Chat | `chat` | `/chat` | — | — |
| `admin` | Admin | `admin_panel_settings` | — | — | 1 |
| `admin` > `users` | Users | `people` | `/admin/users` | `users:read` | — |

Icons are Material Symbols ligatures rendered by `<mat-icon>` in the sibling `navigation` feature.

## Acceptance Criteria

- [ ] `navigationConfig.items` has exactly three top-level entries in order: `smoke-tests`, `chat`, `admin`.
- [ ] `smoke-tests` has `label='Smoke Tests'`, `icon='science'`, `route='/smoke-tests'`, no `children`, no `permission`.
- [ ] `chat` has `label='Chat'`, `icon='chat'`, `route='/chat'`, no `children`, no `permission`.
- [ ] `admin` has `label='Admin'`, `icon='admin_panel_settings'`, no `route`, exactly one child.
- [ ] `admin` > `users` has `label='Users'`, `icon='people'`, `route='/admin/users'`, `permission='users:read'`, no `children`.
- [ ] `NavigationItem` declares `id: string`, `label: string`, optional `icon`, `route`, `children`, `permission`, `badge` (all other fields forbidden by `strict` TS).
- [ ] `flattenNavigation(navigationConfig.items)` returns 4 items in order `smoke-tests, chat, admin, users` (parent before child).
- [ ] `flattenNavigation([])` returns `[]`.
- [ ] `findActiveNavItem(navigationConfig.items, '/chat')` returns the `chat` item.
- [ ] `findActiveNavItem(navigationConfig.items, '/admin/users')` returns the `users` item (nested lookup).
- [ ] `findActiveNavItem(navigationConfig.items, '/unknown')` returns `null`.
- [ ] `findActiveNavItem(navigationConfig.items, '')` returns `null` (the `admin` group has no `route`, so no entry matches `''`).
- [ ] `findParentNavItem(navigationConfig.items, 'users')` returns the `admin` item.
- [ ] `findParentNavItem(navigationConfig.items, 'chat')` returns `null` (top-level item has no parent in this tree).
- [ ] `findParentNavItem(navigationConfig.items, 'missing')` returns `null`.
- [ ] `NavigationConfigModule` is an empty `@NgModule({})` with no declarations, imports, or providers.

## Discrepancies

- `NavigationItem.permission` is declared (`types.ts:8`) and set to `'users:read'` on Admin > Users (`navigation-config.ts:27`) but is enforced nowhere. The renderer (`navigation/components/navigation-tree/navigation-tree.component.ts`) does not filter on it, and the `/admin/users` route in `app.routes.ts` has no `permissionGuard`. The field is currently dead metadata — any authenticated user sees and can click the Admin > Users link. Either wire `permissionGuard('users:read')` onto the route (`features/keycloak-auth/guards/permission.guard.ts:7-18`) or have the tree consume the field (e.g. `*appRequirePermission="item.permission"`).
- `flattenNavigation`, `findActiveNavItem`, and `findParentNavItem` are exported from the barrel (`index.ts:3`) but have no callers elsewhere in the app. They are implemented and tested but currently unused by consumers.
