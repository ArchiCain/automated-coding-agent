# User Management — Test Plan

## Contract Tests

- [ ] `/admin/users` page loads and displays user list when authenticated as admin
- [ ] `/admin/users/new` page renders form with fields: email, firstName, lastName, role (select), temporaryPassword
- [ ] Submitting the create-user form with valid data redirects to `/admin/users`
- [ ] Backend creates user in Keycloak with specified email, name, role, and temporary password

## Behavior Tests

- [ ] Admin can log in using specific selectors (`input[id="username"]`) and navigate to `/admin/users`
- [ ] "New User" link (matching `/new user|create user|add user/i`) navigates to `/admin/users/new`
- [ ] Form accepts: email (timestamp-unique), first name, last name, role selection ("user" option), temporary password
- [ ] "Create User" / "Save" button submits form and redirects to `/admin/users`
- [ ] Logout via header icon button redirects to login page
- [ ] New user can log in with email as username and temporary password
- [ ] Login result is one of: redirect to app (success), password change prompt (expected for temp passwords), or error (test failure)

## E2E Scenarios

- [ ] Full user lifecycle: admin logs in, navigates to user management, creates user with unique email (`testuser-{timestamp}@example.com`) / "Test" / "User" / role "user" / password "TempPass123!", submits, verifies redirect to user list, logs out, logs in as new user, verifies login succeeds or prompts password change
- [ ] Unique user per run: test generates timestamp-based email to avoid conflicts across test runs
- [ ] Screenshot captured at `test-results/new-user-login-result.png` for debugging login result

## Implementation Notes

- Uses specific CSS selectors (`input[id="email"]`, `input[name="firstName"]`) rather than label matchers to avoid ambiguity with password visibility toggles
- Logout detection uses multiple fallback selectors: aria-label, data-testid, last header button
- Test handles three possible login outcomes gracefully (redirect, password change, error)
