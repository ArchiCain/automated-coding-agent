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
