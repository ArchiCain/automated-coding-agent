# Navigation Config — Spec

## What it is

The data feature that defines the app's left-hand navigation tree. It is the single source of truth for what appears in the sidebar, consumed by the sibling `navigation` feature. This feature owns data only — it contributes no components, no dependency injection, and no runtime behavior beyond a few pure helper functions.

## How it behaves

### The nav tree

The tree is a static value built when the module loads — no factory, no service, no injection. It has exactly three top-level entries, in order: Smoke Tests (a leaf linking to `/smoke-tests`, icon `science`), Chat (a leaf linking to `/chat`, icon `chat`), and Admin (a group with icon `admin_panel_settings` and no route of its own). Admin has exactly one child: Users, which links to `/admin/users` with icon `people` and carries a permission tag of `users:read`. Icons are Material Symbols ligatures rendered by the sibling `navigation` feature.

### The item shape

Each item has a required id and label, plus optional icon (a Material ligature), route (an Angular router path), children (nested items for groups), permission (a metadata tag), and badge. An item with children is treated as a group and has no route of its own; an item with a route is a leaf. This group-vs-leaf distinction is a convention — TypeScript does not enforce it, since both fields are optional.

### Utility helpers

Three pure functions are exported for traversing the tree. The flatten helper does a depth-first pre-order walk, returning parents before their descendants. The active-item lookup flattens the tree and returns the first item whose route is an exact string match for the given path — no prefix matching, no query-string handling, no trailing-slash normalization; on no match it returns null. The parent lookup does a recursive DFS and returns the nearest ancestor group that lists the given child id in its children, or null.

### Module wrapper

An empty NgModule is exported as a barrel for NgModule-style consumers. It holds no declarations, imports, or providers.

## Acceptance criteria

- [ ] The tree has exactly three top-level entries, in order: Smoke Tests, Chat, Admin.
- [ ] Smoke Tests has label "Smoke Tests", icon `science`, route `/smoke-tests`, no children, no permission.
- [ ] Chat has label "Chat", icon `chat`, route `/chat`, no children, no permission.
- [ ] Admin has label "Admin", icon `admin_panel_settings`, no route, and exactly one child.
- [ ] Admin's child has id `users`, label "Users", icon `people`, route `/admin/users`, permission `users:read`, no children.
- [ ] An item's shape declares required `id` and `label` and optional `icon`, `route`, `children`, `permission`, and `badge` — no other fields.
- [ ] Flattening the tree returns 4 items in order: Smoke Tests, Chat, Admin, Users (parent before child).
- [ ] Flattening an empty list returns an empty list.
- [ ] Looking up the active item by `/chat` returns the Chat item.
- [ ] Looking up the active item by `/admin/users` returns the Users item (nested lookup works).
- [ ] Looking up the active item by an unknown route returns null.
- [ ] Looking up the active item by the empty string returns null (the Admin group has no route, so nothing matches).
- [ ] Looking up the parent of `users` returns the Admin item.
- [ ] Looking up the parent of `chat` returns null (top-level items have no parent here).
- [ ] Looking up the parent of a missing id returns null.
- [ ] The module wrapper is an empty NgModule with no declarations, imports, or providers.

## Known gaps

- The permission tag on items is dead metadata. The Admin > Users item carries `users:read`, but nothing consumes it: the renderer in the sibling `navigation` feature does not filter on it, and the `/admin/users` route has no permission guard attached. Any authenticated user sees and can click the link. It would need to be wired into either the renderer (e.g. a structural directive that hides items by permission) or onto the route as a guard.
- The three utility helpers — flatten, active-item lookup, and parent lookup — are exported from the barrel but have no callers elsewhere in the app. They are implemented but currently unused.

## Code map

Paths are relative to `projects/application/frontend/app/`.

| Concern | File · lines |
|---|---|
| The nav tree value (Smoke Tests, Chat, Admin > Users) | `src/app/features/navigation-config/navigation-config.ts:3-32` |
| Item shape (id, label, icon?, route?, children?, permission?, badge?) | `src/app/features/navigation-config/types.ts:2-10` |
| Config shape (`{ items }`) | `src/app/features/navigation-config/types.ts:13-15` |
| Flatten helper (DFS pre-order, parent before children) | `src/app/features/navigation-config/navigation-utils.ts:4-13` |
| Active-item lookup (exact route match) | `src/app/features/navigation-config/navigation-utils.ts:16-22` |
| Parent lookup (nearest ancestor by child id) | `src/app/features/navigation-config/navigation-utils.ts:25-39` |
| Empty NgModule wrapper | `src/app/features/navigation-config/navigation-config.module.ts:3-4` |
| Barrel exports | `src/app/features/navigation-config/index.ts:1-4` |
| Admin > Users permission tag (`users:read`) | `src/app/features/navigation-config/navigation-config.ts:27` |
| Renderer that consumes the tree (does not filter on permission) | `src/app/features/navigation/components/navigation-tree/navigation-tree.component.ts` |
| Sidebar consumer | `src/app/features/navigation/components/left-navigation-sidebar/left-navigation-sidebar.component.ts:28` |
| Drawer consumer | `src/app/features/navigation/components/left-navigation-drawer/left-navigation-drawer.component.ts:33` |
| Route for `/admin/users` (no permission guard attached) | `src/app/app.routes.ts` |
| Permission guard factory (available but unused by nav) | `src/app/features/keycloak-auth/guards/permission.guard.ts:7-18` |
