# E2E Tests — Overview

## What This Is

Playwright end-to-end tests covering the full application stack (frontend + backend + Keycloak). Tests run sequentially with a single worker to avoid auth conflicts. The suite validates authentication flows, protected route guards, chat/AI streaming, responsive navigation, user management, and the coding agent workflow.

## Tech Stack

- **Framework:** Playwright 1.48.2
- **Language:** TypeScript 5.7
- **Browser:** Chromium (Desktop Chrome device profile)
- **Reporting:** HTML report + list reporter; traces/screenshots/video on failure
- **Config:** `playwright.config.ts` loads `.env` from repo root for port overrides

## Prerequisites

- All services running: `task start-local`
- Keycloak realm imported with admin user (`admin`/`admin`) and test user
- For coding-agent-workflow tests: separate frontend (port 3001) and backend (port 8086) must be running

## Test Suites

| Suite | File | Description |
|-------|------|-------------|
| Login | `auth/login.spec.ts` | Login page rendering, valid/invalid credentials, redirects |
| Protected Routes | `auth/protected-routes.spec.ts` | Auth guards, session isolation, redirect preservation |
| User Management | `user-management/create-user-login.spec.ts` | Admin creates user via form, new user logs in |
| Chat | `chat/send-message.spec.ts` | Chat UI, message sending, streaming response accumulation |
| Navigation | `hamburger-menu.spec.ts` | Responsive hamburger drawer across mobile/tablet/desktop |
| Workflow | `coding-agent-workflow.spec.ts` | Plan dashboard, creation, AI decomposition, task editing, file verification |

## Architecture

```
e2e/app/
  playwright.config.ts    — Playwright configuration (ports, timeouts, reporters)
  fixtures/test-data.ts   — Shared credentials, URLs, messages, timeouts
  tests/
    auth/                  — Authentication tests
    chat/                  — Chat/AI streaming tests
    user-management/       — Admin user creation flow
    hamburger-menu.spec.ts — Navigation drawer tests
    coding-agent-workflow.spec.ts — Coding agent plan workflow
```

## Configuration

- **Test timeout:** 60s per test, 10s per assertion
- **Action timeout:** 15s for click/fill actions
- **Navigation timeout:** 30s for page loads
- **Workers:** 1 (sequential to avoid auth state conflicts)
- **Retries:** 2 in CI, 0 locally
- **Artifacts:** Traces, screenshots, video retained on failure only

## Test Data

Centralized in `fixtures/test-data.ts`:
- **Admin credentials:** `admin` / `admin`
- **Service ports:** frontend (env `FRONTEND_PORT` or 3000), backend (env `BACKEND_PORT` or 8085), Keycloak (env `KEYCLOAK_PORT` or 8081)
- **Paths:** `/` (home, also conversational AI), `/login`
- **Test messages:** simple greeting, question, long text
- **Timeouts:** short (5s), medium (15s), long (30s), streaming (45s)

## Running

```bash
npm test              # Headless (Chromium)
npm run test:headed   # With visible browser
npm run test:debug    # Playwright debug mode
npm run test:ui       # Playwright interactive UI
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FRONTEND_PORT` | 3000 | Frontend service port |
| `BACKEND_PORT` | 8085 | Backend service port |
| `KEYCLOAK_PORT` | 8081 | Keycloak service port |
| `CODING_AGENT_FRONTEND_PORT` | 3001 | Coding agent frontend port |
| `CODING_AGENT_BACKEND_PORT` | 8086 | Coding agent backend port |
| `CI` | — | Enables retries and forbids `.only` |
