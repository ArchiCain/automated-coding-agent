# Login Page

**Route:** `/login`
**Auth:** Public (outside the protected parent route)
**Feature directory:** `src/app/features/auth/pages/login/`

## Purpose

Authenticate users via email and password. On success, the backend sets HTTP-only cookies and the frontend stores the user profile + permissions in memory. Redirects to `/home`.

## Acceptance Criteria

- [ ] Full-page centered card layout (no sidenav)
- [ ] Dark background (#121212), card surface (#1e1e1e)
- [ ] "Sign In" heading in the card
- [ ] Email field with `appearance="outline"`, default border-radius
- [ ] Password field with `appearance="outline"`, default border-radius
- [ ] "Sign In" button — `mat-flat-button color="primary"`, clearly visible
- [ ] Loading spinner on button while login request is in flight
- [ ] Error message appears below form on failed login
- [ ] On success: user profile + permissions stored in AuthService signals, redirect to `/home`
- [ ] Does NOT store tokens in localStorage — cookies are HTTP-only
- [ ] If already authenticated (session cookie valid), redirect to `/home` immediately
- [ ] Form validation: both fields required, email field validates email format
- [ ] No branding, no logos, no company names
