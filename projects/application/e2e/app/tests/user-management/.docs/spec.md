# User Management Tests — Requirements

## What It Tests

End-to-end user creation flow: admin creates a user, then the new user logs in.

## Tests (`user-management/create-user-login.spec.ts`)

- [ ] Admin logs in and navigates to `/admin/users`
- [ ] Admin clicks "New User" and is taken to `/admin/users/new` form
- [ ] Admin fills in email, first name, last name, role, and temporary password
- [ ] Admin submits the form and is redirected back to `/admin/users`
- [ ] Admin logs out and is redirected to login page
- [ ] New user logs in with email and temporary password
- [ ] New user is either redirected to app (success) or prompted to change password (expected for temporary passwords)
