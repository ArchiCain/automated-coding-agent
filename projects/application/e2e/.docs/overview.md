# E2E Tests — Overview

## What This Is

Playwright end-to-end tests covering the full application stack (frontend + backend + Keycloak). Tests run sequentially with a single worker to avoid auth conflicts.

## Tech Stack

- **Framework:** Playwright 1.48.2
- **Language:** TypeScript 5.7
- **Browser:** Chromium
- **Reporting:** HTML report with traces/screenshots/video on failure

## Test Suites

| Suite | File | Description |
|-------|------|-------------|
| [Login](features/auth/requirements.md) | `auth/login.spec.ts` | Login page, credentials, redirects |
| [Protected Routes](features/auth/requirements.md) | `auth/protected-routes.spec.ts` | Auth guards, redirect preservation |
| [User Management](features/users/requirements.md) | `user-management/create-user-login.spec.ts` | Admin creates user, new user logs in |
| [Chat](features/chat/requirements.md) | `chat/send-message.spec.ts` | Chat interface and streaming |
| [Navigation](features/navigation/requirements.md) | `hamburger-menu.spec.ts` | Responsive nav across viewports |
| [Workflow](features/workflow/requirements.md) | `coding-agent-workflow.spec.ts` | Plan creation, decomposition, task editing |

## Configuration

- **Test timeout:** 60 seconds
- **Workers:** 1 (sequential)
- **Retries:** 2 in CI only
- **Artifacts:** Traces, screenshots, video captured on failure

## Test Data

Centralized in `fixtures/test-data.ts`:
- Admin credentials: `admin` / `admin`
- Service URLs: frontend (3000), backend (8085), Keycloak (8081)
- Page paths, test messages, timeout constants

## Running

```bash
npm test              # Headless
npm run test:headed   # With browser
npm run test:debug    # Debug mode
npm run test:ui       # Playwright UI
```
