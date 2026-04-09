# E2E Tests

Browser-based end-to-end tests using Playwright, validating complete user workflows across the full application stack.

## Prerequisites

All services must be running:

```bash
task start-local
```

## Running tests

```bash
task e2e:install              # Install dependencies (one-time)
task e2e:test                 # Run all tests (headless)
task e2e:test:headed          # Run with visible browser
task e2e:test:debug           # Run with Playwright inspector
task e2e:test:ui              # Interactive Playwright UI
task e2e:test:specific -- auth/login.spec.ts   # Run specific test
task e2e:report               # View HTML report
```

## Test coverage

| Suite | File | What it covers |
|-------|------|----------------|
| Authentication | `auth/login.spec.ts` | Login page, valid/invalid credentials, redirect |
| Protected Routes | `auth/protected-routes.spec.ts` | Access control, unauthorized redirects |
| Chat | `chat/send-message.spec.ts` | Message sending, display, chat interface |
| User Management | `user-management/create-user-login.spec.ts` | User creation, new user login |
| THE Dev Team | `coding-agent-workflow.spec.ts` | AI agent interactions |
| Navigation | `hamburger-menu.spec.ts` | Menu interactions, page navigation |

## Configuration

Tests connect to:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8085`
- Keycloak: `http://localhost:8081`

Key Playwright settings:

- 60-second test timeout
- Single worker (sequential execution)
- Screenshots, video, and traces captured on failure
- 2 retries in CI

## Test credentials

Default: `admin/admin` (Keycloak realm admin user). Additional test users can be created in Keycloak.

## Debugging

```bash
task e2e:test:trace           # Run with trace capture
task e2e:list-traces          # List available traces
task e2e:show-trace -- <path> # Open trace viewer
```

## Best practices

- Keep E2E tests minimal (5-20 total) — focus on critical user journeys
- Test actual user workflows, not implementation details
- Run specific tests during development, full suite before merge
- Use headed mode to debug failures
