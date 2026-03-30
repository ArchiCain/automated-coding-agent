# E2E Tests

Playwright browser automation tests covering critical user workflows across the full application stack.

## Project Structure

```
projects/application/e2e/
└── app/
    ├── tests/
    │   ├── auth/
    │   │   ├── login.spec.ts              # Login page, credentials, redirects
    │   │   └── protected-routes.spec.ts   # Auth guards, redirect preservation
    │   ├── chat/
    │   │   └── send-message.spec.ts       # Chat interface, streaming responses
    │   ├── user-management/
    │   │   └── create-user-login.spec.ts  # Admin creates user, new user logs in
    │   ├── coding-agent-workflow.spec.ts  # Plan creation, decomposition, task editing
    │   └── hamburger-menu.spec.ts         # Navigation across mobile/tablet/desktop
    ├── fixtures/
    │   └── test-data.ts                   # Credentials, URLs, timeouts
    ├── playwright.config.ts
    └── package.json
```

## Running Tests

All services must be running first: `task start-local`

```bash
task e2e:install              # Install dependencies + Playwright (one-time)
task e2e:test                 # Run all tests (headless)
task e2e:test:headed          # Visible browser
task e2e:test:debug           # Playwright inspector
task e2e:test:ui              # Interactive Playwright UI
task e2e:test:specific -- auth/login.spec.ts   # Specific test
task e2e:report               # View HTML report
```

## Test Coverage

| Suite | What it covers |
|-------|----------------|
| **Login** | Login page display, valid/invalid credentials, redirect after login |
| **Protected Routes** | Auth guards, redirect to login, destination preservation |
| **Chat** | Chat interface, message sending, streaming responses, input clearing |
| **User Management** | Admin creates user with unique email, new user login with temp password |
| **Coding Agent** | Plan creation, decomposition, task editing, validation errors, cancel handling |
| **Navigation** | Hamburger menu across mobile (375x667), tablet (768x1024), desktop (1280x720) |

## Configuration

- **Test timeout:** 60s (180s for AI decomposition)
- **Workers:** 1 (sequential to avoid auth state conflicts)
- **Retries:** 2 in CI only
- **Traces/screenshots/video:** captured on failure
- **Browser:** Chromium only
- **Test credentials:** admin/admin

## Tech Stack

Playwright 1.48, TypeScript 5.7, dotenv for environment loading.
