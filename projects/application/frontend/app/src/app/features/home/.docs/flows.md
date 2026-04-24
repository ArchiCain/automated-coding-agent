# Home — Flows

All paths are relative to repo root under `projects/application/frontend/app/`.

## Flow 1: Page load (happy path)

1. User logs in successfully. `AuthService.login()` calls `this.router.navigate(['/'])` (`src/app/features/keycloak-auth/services/auth.service.ts:56`).
2. Router matches `{ path: '', redirectTo: 'home', pathMatch: 'full' }` in `app.routes.ts` and redirects to `/home`.
3. `authGuard` runs on the parent route. The user is authenticated (login just succeeded), so the guard passes.
4. Angular lazy-loads `HomePage` via the `/home` child route: `import('./features/home/pages/home.page').then(m => m.HomePage)`.
5. `HomePage` template renders:
   1. **Greeting** — reads `AuthService.user()`. Computes `displayName` as `user.firstName ?? user.username`. Renders `"Welcome back, {displayName}"`.
   2. **Status row** — renders `<app-backend-health-check />` and `<app-typeorm-database-client />` side-by-side. These are self-contained; no inputs needed. Each starts idle until the user clicks "Check".
   3. **Card grid** — reads `navigationConfig.items`, flattens the tree (see Flow 3), filters by permission (see Flow 4), and renders a `<app-feature-card>` for each surviving item.

## Flow 2: Direct navigation to `/home` (already authenticated)

1. User is already logged in (session cookie valid) and navigates directly to `/home` (e.g., bookmark, URL bar).
2. `authGuard` fires `AuthService.checkAuth()` which calls `GET /auth/check` (`auth.service.ts:81-93`).
3. Server confirms authentication → `_user` signal is set → guard allows navigation.
4. `HomePage` renders exactly as in Flow 1, step 5.
5. If `checkAuth` fails (expired session) → guard redirects to `/login`.

## Flow 3: Nav config flattening

This runs at render time inside `HomePage` (a computed signal or getter).

1. Start with `navigationConfig.items` — an array of `NavigationItem`.
2. Walk the array. For each item:
   - If the item has a `route` → include it in the flat list.
   - If the item has `children` → recurse into `children`, applying the same logic. The parent item itself is included only if it also has a `route`.
3. Result for the current config: `[Smoke Tests (/smoke-tests), Chat (/chat), Users (/admin/users)]`. The "Admin" group item has no `route`, so it's excluded; its child "Users" is promoted to the top level.

## Flow 4: Permission filtering

Runs after flattening, before rendering.

1. For each item in the flat list:
   - If `item.permission` is undefined or null → include (visible to all authenticated users).
   - If `item.permission` is defined → call `AuthService.hasPermission(item.permission)`.
     - Returns `true` → include.
     - Returns `false` → exclude.
2. Example for a `user`-role user:
   - Smoke Tests: no permission field → **included**.
   - Chat: no permission field → **included**.
   - Users: `permission: 'users:read'` → `user` role does NOT have `users:read` → **excluded**.
3. Example for an `admin`-role user:
   - All three items → **included** (admin has `users:read`).

## Flow 5: Card click → navigation

1. User clicks a feature card.
2. The card's `routerLink` directive navigates to the item's `route` (e.g., `/chat`, `/smoke-tests`, `/admin/users`).
3. Angular's router handles the transition — the home page is destroyed, the target feature page loads.

## Flow 6: Old default redirect removed

1. Existing bookmarks or links to `/` now land on `/home` instead of `/smoke-tests`.
2. Direct links to `/smoke-tests` still work — the route is unchanged.
3. The nav menu still lists "Smoke Tests" — clicking it navigates to `/smoke-tests` as before.

## Flow 7: User without `firstName`

1. A user whose Keycloak profile has no `firstName` set authenticates.
2. `AuthService.user()` returns a `User` where `firstName` is `undefined`.
3. `HomePage` greeting falls back: `user.firstName ?? user.username` → renders `"Welcome back, {username}"`.
