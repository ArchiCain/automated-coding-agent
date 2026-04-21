# Auth Feature — Test Plan

## Auth Infrastructure

- [ ] `provideAuth()` wires interceptors and APP_INITIALIZER in one call
- [ ] Session restores on page refresh via `GET /api/auth/check`
- [ ] `checkSession()` silently returns null on failure (no error thrown)
- [ ] Permissions loaded from server response, not mapped client-side
- [ ] 401 on non-auth routes triggers token refresh with retry queue
- [ ] Concurrent 401s result in only ONE refresh call (BehaviorSubject lock)
- [ ] Failed refresh redirects to `/login` and clears user state
- [ ] 403 shows snackbar "Access denied" (no redirect)
- [ ] 5xx shows snackbar "Something went wrong. Please try again."
- [ ] `withCredentials: true` added to every HTTP request by interceptor
- [ ] Auth routes (`/auth/*`) excluded from retry logic

## Guards

- [ ] `authGuard` redirects unauthenticated users to `/login`
- [ ] `permissionGuard('users:read')` redirects unauthorized users to `/home` (not `/login`)
- [ ] Guards evaluate after app bootstrap completes

## Login Page

- [ ] Full-page centered card layout (no sidenav)
- [ ] Email field with `appearance="outline"` and required validation
- [ ] Password field with `appearance="outline"` and required validation
- [ ] Email field validates format (rejects non-email strings)
- [ ] "Sign In" button full width, `mat-flat-button color="primary"`
- [ ] Loading spinner on button during request
- [ ] Form inputs disabled during request
- [ ] Error message below form on 401 ("Invalid credentials")
- [ ] Form fields NOT cleared on error
- [ ] Redirects to `/home` on successful login
- [ ] Redirects to `/home` if already authenticated (without showing form)
- [ ] Does NOT store tokens in localStorage or sessionStorage
- [ ] Empty form submission shows "Required" mat-error on both fields (no API call)
- [ ] Invalid email format shows mat-error (no API call)
