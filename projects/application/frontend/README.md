# Frontend

React + Vite frontend — conversational AI chat interface, user management, and Keycloak authentication.

## Project Structure

```
projects/application/frontend/
├── app/
│   ├── src/
│   │   ├── main.tsx                     # Entry: AuthProvider → MuiThemeProvider → App
│   │   ├── App.tsx                      # Routing
│   │   └── features/
│   │       ├── api-client/              # Axios HTTP client + WebSocket client
│   │       ├── app-header/              # Header with avatar menu + navigation
│   │       ├── keycloak-auth/           # Auth context, hooks, guards, login
│   │       ├── layouts/                 # App layout, responsive breakpoints
│   │       ├── mastra-agents/           # Chat UI, message list, markdown, history
│   │       ├── mui-theme/               # Material UI theme + branding config
│   │       ├── navigation/              # Sidebar drawer + tree navigation
│   │       ├── navigation-config/       # Menu structure definition
│   │       ├── shared/                  # Confirmation modal
│   │       ├── testing-tools/           # Smoke tests, health check, DB client UI
│   │       ├── theme/                   # Dark/light toggle hook + API
│   │       └── user-management/         # User CRUD admin pages
│   ├── test/                            # Test setup
│   ├── vite.config.ts                   # Build + unit test config
│   └── vitest.integration.config.ts     # Integration test config
├── dockerfiles/
│   ├── local.Dockerfile                 # Dev image with hot reload
│   └── prod.Dockerfile                  # Multi-stage with nginx
└── Taskfile.yml
```

## Features

| Feature | Purpose |
|---------|---------|
| **api-client** | Axios with automatic token refresh, request queuing during refresh, inactivity timeout. WebSocket client for Socket.io |
| **keycloak-auth** | `AuthProvider` context, `useAuth` hook, `ProtectedRoute`, `RequirePermission`, login/login-form components, permission system |
| **mastra-agents** | Full chat interface: `ChatProvider`, message input/list, markdown rendering with syntax highlighting, conversation history sidebar |
| **mui-theme** | Material UI theme provider, branding config, palette/typography |
| **navigation** | Responsive sidebar with hierarchical tree navigation |
| **theme** | `useTheme` hook, theme toggle component, persistence via backend API |
| **user-management** | Users table, user form, delete modal, CRUD pages |
| **testing-tools** | Smoke test page with backend health check and database client UI |

## Routes

| Path | Component | Auth |
|------|-----------|------|
| `/login` | Login page | No |
| `/` | Conversational AI chat | Yes |
| `/smoke-tests` | Smoke tests | Yes |
| `/admin/users` | Users list | Yes |
| `/admin/users/new` | Create user | Yes |
| `/admin/users/:id` | Edit user | Yes |

## Key Behaviors

- **Cookie-based auth** — backend manages JWT in HTTP-only cookies
- **Proactive token refresh** — every 4 minutes (tokens expire in 5)
- **Inactivity timeout** — session expires after 30 minutes
- **Real-time chat** — Socket.io streaming for AI responses with markdown + code highlighting
- **RBAC** — `hasPermission()` checks for conditional UI rendering

## Tasks

```bash
task frontend:local:start              # Start in Docker with hot reload
task frontend:local:run                # Run outside Docker (vite dev server)
task frontend:local:test               # Unit tests (Vitest)
task frontend:local:test:integration   # Integration tests (requires backend)
task frontend:local:test:coverage      # Coverage report (80% threshold)
task frontend:local:lint               # ESLint
task frontend:local:type-check         # TypeScript check
```

## Tech Stack

React 19, Vite 6, TypeScript 5.8, Material UI 6.5, React Router 7.9, Axios 1.12, Socket.io Client 4.8, Vitest 1.6, React Testing Library 16.
