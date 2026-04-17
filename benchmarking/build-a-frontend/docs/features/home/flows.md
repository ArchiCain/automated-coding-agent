# Welcome Page — Flows

## Flow 1: Admin Visits Welcome Page

1. Admin user is authenticated and navigates to `/home`
2. Page shows "Welcome, Admin" (uses firstName from user profile)
3. Intro paragraph is visible
4. Two feature cards are displayed:
   - **User Management** — icon: people, description about managing users
   - **Smoke Tests** — icon: monitor_heart, description about health checks
5. Admin clicks "User Management" card
6. Navigated to `/users`

## Flow 2: Regular User Visits Welcome Page

1. Regular user is authenticated and navigates to `/home`
2. Page shows "Welcome, Regular" (uses firstName from user profile)
3. Intro paragraph is visible
4. Only one feature card is displayed:
   - **Smoke Tests** — icon: monitor_heart
5. User Management card is NOT visible (user lacks `users:read` permission)
6. User clicks "Smoke Tests" card
7. Navigated to `/smoke-tests`

## Flow 3: User Without firstName

1. User with no firstName set is authenticated
2. Page shows "Welcome, user@example.com" (falls back to username)

## Flow 4: Unauthenticated Access

1. Unauthenticated user navigates to `/home`
2. `authGuard` on parent route fires
3. User is redirected to `/login`
4. Welcome page is never rendered
