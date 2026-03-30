---
id: p-657e0d
created: 2026-01-25T20:39:39.685Z
updated: 2026-01-25T21:15:00.000Z
---

# Angular Frontend Migration

## Problem Statement

The current automated-repo frontend is built with React 19, Material UI, and Vite. While functional, there's a desire to create a parallel Angular-based frontend (`projects/frontend-angular`) that recreates all user-facing functionality while leveraging Angular's architecture patterns and the established Material Angular styling conventions already proven in the `projects/coding-agent-frontend` project.

This new Angular frontend should be a drop-in replacement that connects to the existing backend (port 8085), maintaining full feature parity for conversational AI, smoke testing, user management, and authentication—but with cleaner Angular architecture, better styling consistency, and the refined UI patterns from the coding-agent-frontend template.

## Requirements

### Functional

- **Conversational AI Chat** (route: `/`)
  - Real-time WebSocket chat with Mastra AI agent via `/mastra-chat` namespace
  - Message streaming with chunked responses
  - Conversation history sidebar (collapsible on desktop, drawer on mobile)
  - Thread-based conversation management with unique IDs
  - Markdown rendering with syntax highlighting for code blocks
  - Auto-scrolling message list
  - Shift+Enter for newlines, Enter to send

- **Smoke Tests Page** (route: `/smoke-tests`)
  - Backend health check with auto-refresh (30-second intervals)
  - Database connectivity testing
  - Manual refresh button with timestamp display
  - Color-coded status indicators

- **User Management** (route: `/admin/users`)
  - User list with pagination (5, 10, 25, 50 rows)
  - Search by username, email, or name with debounce (300ms)
  - Sortable columns
  - Inline user enable/disable toggle
  - Create/edit/delete user with confirmation modal

- **Authentication & Login** (route: `/login`)
  - Username/password login form
  - JWT token management with proactive refresh (4 minutes before expiry)
  - 30-minute inactivity timeout with automatic logout
  - Permission-based route guards (`users:read` for admin)

- **WebSocket Integration**
  - Socket.io client connecting to backend namespaces
  - `/mastra-chat` for message streaming
  - `/mastra-chat-history` for conversation history
  - Session management with userId and threadId

### Non-Functional

- **Styling**: Match the Material Angular patterns from `coding-agent-frontend`:
  - Material Design v3 with Azure/Blue palette
  - Light theme with consistent color system
  - 8px base spacing unit
  - Consistent border radius (4px, 8px, 12px)
  - Standard transitions (0.2s ease)
  - Responsive design with mobile drawer patterns

- **Architecture**: Follow template Feature Architecture pattern with:
  - All code in `features/` directory (no separate `pages/` directories)
  - Feature-based organization (full-stack vs shared features)
  - Signals for reactive state management
  - Lazy-loaded routes
  - Component-level SCSS with encapsulation

- **Container-First Development**: Follow template Docker patterns:
  - Dockerfile for production builds
  - docker-compose.yml for local development
  - Taskfile.yml for standardized automation commands

- **Performance**:
  - Lazy loading for feature modules
  - Efficient WebSocket connection management
  - Debounced search inputs

- **Testing**: Vitest setup for unit testing (matching existing patterns)

## Architecture

### Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Angular | 21.x | Application framework |
| Angular Material | 21.x | UI component library |
| Angular CDK | 21.x | Component dev kit |
| Socket.io Client | 4.8.x | WebSocket communication |
| ngx-markdown | 21.x | Markdown rendering |
| PrismJS | 1.x | Syntax highlighting |
| Vite (via Angular CLI) | - | Build system |
| Vitest | - | Unit testing |

### Project Structure (Template-Aligned)

Following the template's Project Architecture and Feature Architecture patterns:

```
projects/frontend-angular/
├── app/                              # Application source (template pattern)
│   ├── angular.json
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src/
│       ├── index.html
│       ├── main.ts
│       ├── styles.scss               # Material theme (Azure/Blue)
│       └── app/
│           ├── app.component.ts
│           ├── app.config.ts
│           ├── app.routes.ts
│           └── features/             # ALL CODE IN FEATURES (template pattern)
│               ├── auth/             # Full-stack feature
│               │   ├── components/
│               │   │   ├── login-form/
│               │   │   │   ├── login-form.component.ts
│               │   │   │   └── login-form.component.scss
│               │   │   └── login-page/
│               │   │       ├── login-page.component.ts
│               │   │       └── login-page.component.scss
│               │   ├── services/
│               │   │   └── auth.service.ts
│               │   ├── guards/
│               │   │   ├── auth.guard.ts
│               │   │   └── permission.guard.ts
│               │   ├── auth.routes.ts
│               │   └── index.ts
│               ├── chat/             # Full-stack feature
│               │   ├── components/
│               │   │   ├── chat-page/
│               │   │   │   ├── chat-page.component.ts
│               │   │   │   └── chat-page.component.scss
│               │   │   ├── message-list/
│               │   │   │   ├── message-list.component.ts
│               │   │   │   └── message-list.component.scss
│               │   │   ├── message-input/
│               │   │   │   ├── message-input.component.ts
│               │   │   │   └── message-input.component.scss
│               │   │   ├── chat-sidebar/
│               │   │   │   ├── chat-sidebar.component.ts
│               │   │   │   └── chat-sidebar.component.scss
│               │   │   └── markdown-renderer/
│               │   │       ├── markdown-renderer.component.ts
│               │   │       └── markdown-renderer.component.scss
│               │   ├── services/
│               │   │   └── chat.service.ts
│               │   ├── chat.routes.ts
│               │   └── index.ts
│               ├── smoke-tests/      # Full-stack feature
│               │   ├── components/
│               │   │   └── smoke-tests-page/
│               │   │       ├── smoke-tests-page.component.ts
│               │   │       └── smoke-tests-page.component.scss
│               │   ├── services/
│               │   │   └── health.service.ts
│               │   ├── smoke-tests.routes.ts
│               │   └── index.ts
│               ├── user-management/  # Full-stack feature
│               │   ├── components/
│               │   │   ├── users-list-page/
│               │   │   │   ├── users-list-page.component.ts
│               │   │   │   └── users-list-page.component.scss
│               │   │   └── user-form-dialog/
│               │   │       ├── user-form-dialog.component.ts
│               │   │       └── user-form-dialog.component.scss
│               │   ├── services/
│               │   │   └── user.service.ts
│               │   ├── user-management.routes.ts
│               │   └── index.ts
│               ├── api-client/       # Shared feature
│               │   ├── services/
│               │   │   └── api-client.service.ts
│               │   ├── interceptors/
│               │   │   └── auth.interceptor.ts
│               │   └── index.ts
│               ├── websocket/        # Shared feature
│               │   ├── services/
│               │   │   └── websocket.service.ts
│               │   └── index.ts
│               └── shell/            # Shared feature (layout)
│                   ├── components/
│                   │   ├── header/
│                   │   │   ├── header.component.ts
│                   │   │   └── header.component.scss
│                   │   ├── nav-drawer/
│                   │   │   ├── nav-drawer.component.ts
│                   │   │   └── nav-drawer.component.scss
│                   │   ├── slide-over/
│                   │   │   ├── slide-over.component.ts
│                   │   │   └── slide-over.component.scss
│                   │   └── confirm-dialog/
│                   │       ├── confirm-dialog.component.ts
│                   │       └── confirm-dialog.component.scss
│                   └── index.ts
├── dockerfiles/                      # Container definitions (template pattern)
│   ├── Dockerfile                    # Production build
│   └── Dockerfile.dev                # Development with hot reload
├── docker-compose.yml                # Service configuration (template pattern)
├── nginx.conf                        # Production nginx config
├── Taskfile.yml                      # Automation commands (template pattern)
└── README.md
```

### Key Architectural Changes from Previous Plan

1. **No separate `pages/` directory**: Following the Feature Architecture, page components live inside their feature's `components/` folder (e.g., `features/auth/components/login-page/`)

2. **No separate `core/` directory**: Core services are organized as shared features:
   - Auth → `features/auth/` (full-stack feature with guards, services)
   - API Client → `features/api-client/` (shared feature)
   - WebSocket → `features/websocket/` (shared feature)

3. **Shell as a shared feature**: Layout components (header, nav, dialogs) live in `features/shell/`

4. **Standard project structure**: Added `dockerfiles/` directory and `Taskfile.yml` per template conventions

### Backend Integration

The Angular frontend will connect to the same backend as the React frontend:

- **API Base URL**: `http://localhost:8085` (configurable via environment)
- **Auth Endpoints**: `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/check`
- **User Endpoints**: `/users` (CRUD operations)
- **Health Endpoints**: `/health`, `/database/test`
- **WebSocket Namespaces**: `/mastra-chat`, `/mastra-chat-history`

### Styling System (from coding-agent-frontend)

```scss
// Theme definition
$theme: mat.define-theme((
  color: (
    theme-type: light,
    primary: mat.$azure-palette,
    tertiary: mat.$blue-palette,
  ),
  density: (scale: 0)
));

// Color tokens
$primary: #1976d2;
$success: #4caf50;
$warning: #ff9800;
$error: #c62828;
$text-primary: rgba(0, 0, 0, 0.87);
$text-secondary: rgba(0, 0, 0, 0.6);
$divider: rgba(0, 0, 0, 0.12);
```

### Taskfile Commands (Template Pattern)

```yaml
# projects/frontend-angular/Taskfile.yml
version: '3'

tasks:
  local:start:
    desc: Start Angular frontend in development mode
    cmds:
      - docker compose up -d

  local:stop:
    desc: Stop Angular frontend
    cmds:
      - docker compose down

  local:logs:
    desc: View Angular frontend logs
    cmds:
      - docker compose logs -f frontend-angular

  local:shell:
    desc: Get shell access to the container
    cmds:
      - docker compose exec frontend-angular sh

  local:restart:
    desc: Restart with rebuild
    cmds:
      - docker compose down
      - docker compose up -d --build

  local:test:
    desc: Run unit tests
    cmds:
      - docker compose exec frontend-angular npm test
```

## Scope

### In Scope

- Full recreation of React frontend functionality in Angular
- Material Angular styling matching coding-agent-frontend patterns
- WebSocket integration for real-time chat
- Authentication with token refresh and inactivity timeout
- User management admin features
- Smoke tests page
- Responsive design (mobile drawer, desktop sidebar)
- Docker configuration for development and deployment
- Taskfile automation commands
- Unit test setup with Vitest

### Out of Scope

- Dark theme support (can be added later)
- E2E testing setup (Playwright/Cypress)
- CI/CD pipeline configuration
- Backend modifications
- New features beyond existing React frontend

## Open Questions

- [x] Should we implement standalone lazy-loaded routes or NgModule-based lazy loading?
- [x] Preferred state management approach: Signals only, or introduce NgRx for complex state?
- [ ] Should the chat history use localStorage or sessionStorage for thread persistence?
- [ ] Do we want to implement SSR (Server-Side Rendering) from the start?

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Angular Version | 21.x | Match coding-agent-frontend for consistency |
| Component Style | Standalone | Modern Angular pattern, already used in coding-agent-frontend |
| Styling | SCSS with component encapsulation | Matches existing patterns, scoped styles |
| State Management | Angular Signals | Simpler than NgRx, sufficient for this app's complexity |
| Build Tool | Vite (via Angular CLI) | Fast builds, matches existing setup |
| Testing | Vitest | Already proven in coding-agent-frontend |
| WebSocket Library | socket.io-client | Same as React frontend for backend compatibility |
| Code Organization | Feature Architecture | All code in features/, following template docs |
| Project Structure | Template Standard | app/, dockerfiles/, docker-compose.yml, Taskfile.yml |
| Lazy Loading | Standalone routes | Modern Angular pattern with loadComponent() |
