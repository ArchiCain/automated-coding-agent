# Home Feature

**Feature directory:** `src/app/features/home/`
**Page:** `/home` (authenticated — inherited from parent route)

## Purpose

A static informational landing page that welcomes the user and explains what this application is. Provides navigation to available features via feature cards.

## Components

- **FeatureCard** — reusable card with icon, title, description, and route. Entire card is clickable. Hover state changes background.

## Feature Cards

| Icon | Title | Description | Route | Visibility |
|------|-------|-------------|-------|------------|
| `people` | User Management | Manage users, roles, and permissions | `/users` | `hasPermission$('users:read')` |
| `monitor_heart` | Smoke Tests | Check backend service health status | `/smoke-tests` | Always visible |

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
