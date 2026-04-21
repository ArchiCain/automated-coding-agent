# Navigation Config — Test Plan

Pure-data + pure-function feature; unit tests only. Vitest via `@angular/build:unit-test` (`angular.json:72-73`). No `TestBed` needed — import and assert directly.

## Static configuration — `navigationConfig`

- [ ] `navigationConfig.items.length === 3`.
- [ ] `items[0]` equals `{ id: 'smoke-tests', label: 'Smoke Tests', icon: 'science', route: '/smoke-tests' }` with no `children` and no `permission` (`navigation-config.ts:5-10`).
- [ ] `items[1]` equals `{ id: 'chat', label: 'Chat', icon: 'chat', route: '/chat' }` (`navigation-config.ts:11-16`).
- [ ] `items[2].id === 'admin'`, `label === 'Admin'`, `icon === 'admin_panel_settings'`, `route === undefined`, `children.length === 1` (`navigation-config.ts:17-30`).
- [ ] `items[2].children[0]` equals `{ id: 'users', label: 'Users', icon: 'people', route: '/admin/users', permission: 'users:read' }` (`navigation-config.ts:22-28`).
- [ ] `navigationConfig` satisfies `NavigationConfig` (TypeScript compile-time assertion; a test that assigns it to a typed variable also passes).

## Type shape — `NavigationItem` / `NavigationConfig`

- [ ] `NavigationItem` compiles with only `{ id, label }` (all other fields optional) — compile-time assertion via typed test fixture (`types.ts:2-10`).
- [ ] `NavigationItem` rejects unknown properties under `strict` (`tsconfig.json`) — attempting to add a `foo: 'bar'` literal fails to compile.
- [ ] `NavigationConfig` has exactly one field, `items: NavigationItem[]` (`types.ts:13-15`).

## `flattenNavigation`

- [ ] `flattenNavigation([])` returns `[]` (`navigation-utils.ts:4-13`).
- [ ] `flattenNavigation(navigationConfig.items)` returns 4 items in order: `smoke-tests`, `chat`, `admin`, `users` (parent-before-child pre-order).
- [ ] Given a 3-level tree `[A { children: [B { children: [C] }] }]`, returns `[A, B, C]` in order.
- [ ] Input array is not mutated (deep equality check on a deep-cloned copy after the call).
- [ ] Items without `children` contribute only themselves.

## `findActiveNavItem`

- [ ] `findActiveNavItem(navigationConfig.items, '/chat')` returns the `chat` item (reference equality to `items[1]`).
- [ ] `findActiveNavItem(navigationConfig.items, '/admin/users')` returns the nested `users` item.
- [ ] `findActiveNavItem(navigationConfig.items, '/unknown')` returns `null`.
- [ ] `findActiveNavItem([], '/chat')` returns `null`.
- [ ] `findActiveNavItem(navigationConfig.items, '')` returns `null` (the `admin` group has no `route`; undefined `route` never matches `''`).
- [ ] Match is exact string equality — `'/chat/'` (trailing slash) and `'/Chat'` (case) both return `null` (`navigation-utils.ts:21`).

## `findParentNavItem`

- [ ] `findParentNavItem(navigationConfig.items, 'users')` returns the `admin` item (reference equality to `items[2]`).
- [ ] `findParentNavItem(navigationConfig.items, 'chat')` returns `null` (top-level items have no parent in this tree).
- [ ] `findParentNavItem(navigationConfig.items, 'missing')` returns `null`.
- [ ] `findParentNavItem([], 'users')` returns `null`.
- [ ] For a deeper tree `[A { children: [B { children: [C] }] }]`, `findParentNavItem(tree, 'C')` returns `B`; `findParentNavItem(tree, 'B')` returns `A`; `findParentNavItem(tree, 'A')` returns `null`.

## Module

- [ ] `NavigationConfigModule` is defined and decorated with `@NgModule({})` — no declarations, imports, providers, or exports (`navigation-config.module.ts:3-4`).

## Non-goals

- Rendering behavior, permission enforcement, and active-route highlighting — covered by the `navigation` feature test plan.
- `permissionGuard` wiring on `/admin/users` — would belong in an `app.routes` / `keycloak-auth` test plan once the guard is actually applied.
