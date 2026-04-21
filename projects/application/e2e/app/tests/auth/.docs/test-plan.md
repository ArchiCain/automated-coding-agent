# Auth — Test Plan

## Contract Tests

- [ ] Login page renders at `/login` with "Sign In" heading, username input, password input, and "Sign In" button
- [ ] POST to backend auth endpoint with valid credentials returns session cookies (not tested directly; implied by redirect)
- [ ] Unauthenticated requests to protected routes return redirect to `/login`

## Behavior Tests

- [ ] Valid credentials (`admin`/`admin`) redirect user away from `/login` to home (`/`)
- [ ] Invalid credentials (`invalid-user`/`wrong-password`) keep user on login page or display error text matching `/error|invalid|failed/i`
- [ ] Accessing `/` (conversational AI, the protected index route) without auth redirects to `/login`
- [ ] Authenticated user can access `/` and sees the message input placeholder (`/type.*message/i`)
- [ ] New browser context (no cookies) cannot access protected route — redirects to login
- [ ] After redirect-to-login, logging in sends user to originally requested page or home

## E2E Scenarios

- [ ] Full login flow: navigate to `/login`, fill username + password, click "Sign In", verify URL is `/` and "Sign In" heading is gone
- [ ] Invalid login flow: fill bad credentials, submit, verify still on login page or error visible
- [ ] Route guard flow: visit protected route unauthenticated, get redirected to login, log in, arrive at intended destination
- [ ] Session isolation: log in on one context, open new context, verify new context cannot access protected route
