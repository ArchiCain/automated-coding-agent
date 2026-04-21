# Auth Tests — Requirements

## What It Tests

Login flow and route protection across the application.

## Login Tests (`auth/login.spec.ts`)

- [ ] Login page renders with username field, password field, and "Sign In" button
- [ ] Successful login with valid credentials redirects away from login page
- [ ] Successful login redirects to home page (`/`)
- [ ] Invalid credentials keep user on login page or show error message
- [ ] Unauthenticated access to protected route (`/conversational-ai`) redirects to login

## Protected Routes Tests (`auth/protected-routes.spec.ts`)

- [ ] Unauthenticated access to `/conversational-ai` redirects to login
- [ ] Authenticated user can access `/conversational-ai` and sees message input
- [ ] New browser context (simulating logged-out state) cannot access protected route
- [ ] After login redirect, user is sent to originally requested page or home
