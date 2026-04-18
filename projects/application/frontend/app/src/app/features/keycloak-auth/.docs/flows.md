# Auth Feature — Flows

## Flow 1: App Bootstrap (Valid Session)

1. User opens the app (any route)
2. `APP_INITIALIZER` runs `authService.checkSession()`
3. `GET /api/auth/check` is sent (browser includes cookies automatically)
4. Backend validates the cookie, resolves permissions, returns:
   ```json
   { "authenticated": true, "user": { ... }, "permissions": ["users:read", ...] }
   ```
5. AuthService stores user + permissions in signals
6. `isAuthenticated()` returns true
7. App finishes bootstrapping, route guards evaluate
8. If user was navigating to `/login` and is already authenticated, redirect to `/home`
9. Otherwise, render the requested route

## Flow 2: App Bootstrap (No Session / Expired)

1. User opens the app at `/home`
2. `APP_INITIALIZER` runs `authService.checkSession()`
3. `GET /api/auth/check` returns 401 (no cookie or expired)
4. AuthService sets user=null, permissions=[]
5. `isAuthenticated()` returns false
6. App finishes bootstrapping
7. `authGuard` fires for `/home` → user not authenticated → redirect to `/login`

## Flow 3: Login

1. User submits credentials on the login page
2. `authService.login(email, password)` is called
3. `POST /api/auth/login` with `{ username: email, password }`
4. Backend authenticates via Keycloak, sets HTTP-only cookies
5. AuthService calls `checkSession()` to load user + permissions
6. `GET /api/auth/check` returns full profile + permissions
7. AuthService stores everything in signals
8. Login method returns the AuthUser
9. Login page navigates to `/home`

## Flow 4: Token Refresh (Transparent)

1. User is using the app, access token expires
2. Next API call returns 401
3. `authErrorInterceptor` catches the 401
4. Interceptor checks: is this NOT an auth endpoint? (avoids infinite loop)
5. Interceptor calls `authService.refreshToken()`
6. `POST /api/auth/refresh` — browser sends refresh_token cookie
7. Backend issues new tokens, sets new cookies
8. Interceptor retries the original failed request
9. User never notices — the request completes normally

## Flow 5: Token Refresh (Concurrent Requests)

1. Access token expires
2. Three API calls fail with 401 simultaneously
3. First 401 triggers `authService.refreshToken()`
4. Second and third 401s queue behind the refresh (BehaviorSubject lock)
5. Refresh completes, new cookies set
6. All three original requests retry with new cookies
7. Only ONE refresh call was made

## Flow 6: Token Refresh (Failed — Full Logout)

1. Access token expires
2. API call returns 401
3. `authErrorInterceptor` calls `authService.refreshToken()`
4. `POST /api/auth/refresh` also fails (refresh token expired or revoked)
5. `refreshToken()` returns false
6. Interceptor navigates to `/login`
7. AuthService clears user + permissions

## Flow 7: Logout

1. User clicks "Logout" in sidenav
2. `authService.logout()` is called
3. `POST /api/auth/logout` — backend revokes tokens at Keycloak, clears cookies
4. AuthService sets user=null, permissions=[]
5. App navigates to `/login`

## Flow 8: Permission Guard (Authorized)

1. Admin navigates to `/users`
2. `authGuard` passes (user is authenticated)
3. `permissionGuard('users:read')` fires
4. `authService.hasPermission('users:read')` → true (admin has this permission)
5. Route activates, page renders

## Flow 9: Permission Guard (Unauthorized)

1. Regular user navigates to `/users` (e.g. by typing URL directly)
2. `authGuard` passes (user is authenticated)
3. `permissionGuard('users:read')` fires
4. `authService.hasPermission('users:read')` → false
5. Guard redirects to `/home` (not `/login` — user IS authenticated)

## Flow 10: 403 Error Handling

1. User somehow reaches a UI that triggers an API call they're not authorized for
2. Backend returns 403 `{ statusCode: 403, message: "Insufficient permissions" }`
3. `authErrorInterceptor` catches the 403
4. Snackbar shows "Access denied" for 5 seconds
5. No redirect — user stays on current page

## Flow 11: 5xx Error Handling

1. Any API call returns 500+
2. `authErrorInterceptor` catches it
3. Snackbar shows "Something went wrong. Please try again." for 5 seconds
4. Original error is still thrown (calling code can handle it additionally)

---

# Login Page — Flows

## Flow 1: Successful Login (Admin)

1. User navigates to `/login`
2. Page shows centered card with "Sign In" heading
3. User enters `admin@example.com` in Email field
4. User enters `admin123` in Password field
5. User clicks "Sign In"
6. Button shows loading spinner, form inputs are disabled
7. `POST /api/auth/login` is sent with `{ username: "admin@example.com", password: "admin123" }`
8. Backend returns 200 with `{ message: "Login successful", user: { ... } }` and sets cookies
9. Frontend calls `GET /api/auth/check` to load permissions
10. AuthService stores user profile + permissions in signals
11. User is redirected to `/home`
12. Sidenav shows "Admin User" at bottom
13. "Users" nav item is visible (admin has `users:read` permission)

## Flow 2: Successful Login (Regular User)

1. User navigates to `/login`
2. User enters `user@example.com` / `user123`
3. User clicks "Sign In"
4. Same flow as above — backend returns 200, cookies set
5. User is redirected to `/home`
6. Sidenav shows "Regular User" at bottom
7. "Users" nav item is **NOT visible** (no `users:read` permission)

## Flow 3: Invalid Credentials

1. User enters `admin@example.com` / `wrongpassword`
2. User clicks "Sign In"
3. Button shows loading spinner
4. `POST /api/auth/login` returns 401 `{ statusCode: 401, message: "Invalid credentials" }`
5. Loading spinner stops, form re-enables
6. Error message appears below form: "Invalid credentials"
7. Form fields retain their values (NOT cleared)
8. User can modify fields and retry immediately

## Flow 4: Empty Form Submission

1. User clicks "Sign In" without entering anything
2. Form validation fires — both fields show `mat-error` "Required"
3. No API call is made
4. Email field shows "Required" error
5. Password field shows "Required" error

## Flow 5: Invalid Email Format

1. User enters `notanemail` in Email field
2. User enters a password
3. User clicks "Sign In"
4. Email field shows `mat-error` for invalid email format
5. No API call is made

## Flow 6: Already Authenticated

1. User has a valid session (cookies from previous login)
2. User navigates to `/login`
3. Page checks `authService.isAuthenticated()` — returns true
4. User is immediately redirected to `/home` without seeing the login form

## Flow 7: Server Error

1. User enters valid credentials
2. User clicks "Sign In"
3. Backend returns 500
4. Error interceptor shows snackbar "Something went wrong. Please try again."
5. Login form remains usable for retry
