# Welcome Page

**Route:** `/home`
**Auth:** Authenticated (inherited from parent route)
**Feature directory:** `src/app/features/home/`

## Purpose

A static informational landing page that welcomes the user and explains what this application is. Provides navigation to available features via feature cards.

## Acceptance Criteria

- [ ] Shows "Welcome, {firstName}" using stored user data (fall back to username if no firstName)
- [ ] Brief intro paragraph explaining this is a benchmark application
- [ ] Feature cards in a responsive grid (2 columns desktop, 1 column mobile)
- [ ] Each card has a mat-icon, title, description, and navigation action
- [ ] **User Management** card: visible only if user has `users:read` permission
- [ ] **Smoke Tests** card: visible to all authenticated users
- [ ] Cards are clickable — navigate to the respective page
- [ ] Clean layout with appropriate spacing (24px page padding, 16px between cards)
- [ ] No API calls — purely static using data from AuthService
