---
id: t-a9f3e2
parent: p-657e0d
created: 2026-01-26T17:24:00.000Z
updated: 2026-01-26T17:46:00.000Z
---

# Plan: Angular Frontend Implementation

## Purpose
Create a complete Angular-based frontend (`projects/frontend-angular`) that recreates all functionality from the existing React frontend while leveraging Angular 21 architecture patterns and Material Design styling proven in the coding-agent-frontend template.

## Context

### Conventions
Follow the established template patterns for Angular projects:
- **Feature Architecture**: All application code in `src/app/features/` directory (no separate `pages/` directory)
- **Component Structure**: Standalone components with Angular 21 patterns
- **Styling**: Material Angular with Azure/Blue palette matching coding-agent-frontend
- **Code Organization**: Full-stack features (with pages/components) and shared features (utilities/services)
- **Project Structure**: Standard template layout with `app/`, `dockerfiles/`, `docker-compose.yml`, `Taskfile.yml`

Reference existing patterns from:
- `projects/coding-agent-frontend/` - Angular Material theme and feature structure
- `projects/frontend/` - Current React functionality to replicate

```typescript
// Example feature structure (from coding-agent-frontend)
features/
├── auth/                    # Full-stack feature
│   ├── components/
│   │   ├── login-form/
│   │   └── login-page/
│   ├── services/
│   ├── guards/
│   └── auth.routes.ts
├── chat/                    # Full-stack feature
│   ├── components/
│   ├── services/
│   └── chat.routes.ts
└── api-client/              # Shared feature
    ├── services/
    └── interceptors/
```

### Interfaces
```typescript
// Backend API integration points
interface AuthEndpoints {
  login: '/auth/login';
  refresh: '/auth/refresh';
  logout: '/auth/logout';
  check: '/auth/check';
}

interface UserEndpoints {
  list: '/users';
  create: '/users';
  update: '/users/:id';
  delete: '/users/:id';
  toggle: '/users/:id/toggle-enabled';
}

interface HealthEndpoints {
  status: '/health';
  database: '/database/test';
}

interface WebSocketNamespaces {
  chat: '/mastra-chat';
  history: '/mastra-chat-history';
}

// Material Theme Configuration
interface MaterialTheme {
  primary: 'mat.$azure-palette';
  tertiary: 'mat.$blue-palette';
  density: 0;
  mode: 'light';
}
```

### Boundaries
- **Exposes**: Angular web application serving conversational AI, user management, and admin features
- **Consumes**: Existing backend API (port 8085) without modifications
- **Constraints**:
  - Must match existing React frontend functionality exactly
  - Cannot modify backend endpoints or WebSocket namespaces
  - Must follow template Docker and Taskfile patterns
  - Must use Angular 21 with Material Design v21

### References
- `projects/coding-agent-frontend/app/src/styles.scss` - Material theme implementation
- `projects/coding-agent-frontend/app/package.json` - Angular dependencies and versions
- `projects/frontend/app/package.json` - Current React frontend dependencies for feature reference
- `projects/backend/app/src/features/user-management/controllers/user-management.controller.ts` - User API endpoints
- `projects/backend/app/src/features/keycloak-auth/controllers/keycloak-auth.controller.ts` - Auth API endpoints
- `projects/backend/app/src/features/health/controllers/health.controller.ts` - Health check endpoints
- `projects/backend/app/src/features/mastra-agents/controllers/mastra-agents.controller.ts` - Chat API endpoints

## Children

| Name | Path | Description |
|------|------|-------------|
| Conversational AI Chat | ./features/conversational-ai/plan.md | Real-time WebSocket chat interface with Mastra agents |
| Authentication | ./features/authentication/plan.md | JWT-based login system with guards and token management |
| User Management | ./features/user-management/plan.md | Admin interface for user CRUD operations |
| Health Monitoring | ./features/health-monitoring/plan.md | System status and smoke test monitoring |
| Shared UI | ./features/shared-ui/plan.md | Reusable components, theme, and API client services |

## Specification

### Requirements
- **Conversational AI Chat** (route: `/`)
  - Real-time WebSocket chat with Mastra AI agent via `/mastra-chat` namespace
  - Message streaming with chunked responses using Socket.io client v4.8.x
  - Conversation history sidebar (collapsible on desktop, drawer on mobile)
  - Thread-based conversation management with unique IDs
  - Markdown rendering with syntax highlighting using ngx-markdown and PrismJS
  - Auto-scrolling message list with proper UX
  - Shift+Enter for newlines, Enter to send message

- **Smoke Tests Page** (route: `/smoke-tests`)
  - Backend health check with auto-refresh (30-second intervals)
  - Database connectivity testing via `/health` and `/database/test` endpoints
  - Manual refresh button with timestamp display
  - Color-coded status indicators using Material Design colors

- **User Management** (route: `/admin/users`)
  - User list with Material table and pagination (5, 10, 25, 50 rows)
  - Search by username, email, or name with debounce (300ms)
  - Sortable columns using Angular Material table features
  - Inline user enable/disable toggle
  - Create/edit/delete user with Material confirmation dialog

- **Authentication & Login** (route: `/login`)
  - Username/password login form using Angular reactive forms
  - JWT token management with proactive refresh (4 minutes before expiry)
  - 30-minute inactivity timeout with automatic logout
  - Permission-based route guards (`users:read` for admin access)

- **Responsive Design & Styling**
  - Angular Material v21 with Azure/Blue palette
  - Light theme with consistent color system
  - Mobile-first responsive design with drawer navigation
  - 8px base spacing unit and consistent border radius (4px, 8px, 12px)

### Files
Project scaffolding required (new project):
- `projects/frontend-angular/app/` - Angular application source
- `projects/frontend-angular/app/package.json` - Dependencies (Angular 21, Material, Socket.io, etc.)
- `projects/frontend-angular/app/angular.json` - Angular CLI configuration
- `projects/frontend-angular/app/src/main.ts` - Application bootstrap
- `projects/frontend-angular/app/src/styles.scss` - Material theme implementation
- `projects/frontend-angular/app/src/app/app.component.ts` - Root component
- `projects/frontend-angular/app/src/app/app.config.ts` - Application configuration
- `projects/frontend-angular/app/src/app/app.routes.ts` - Route configuration
- `projects/frontend-angular/dockerfiles/Dockerfile` - Production build container
- `projects/frontend-angular/dockerfiles/Dockerfile.dev` - Development container
- `projects/frontend-angular/docker-compose.yml` - Service configuration
- `projects/frontend-angular/Taskfile.yml` - Automation commands
- `projects/frontend-angular/README.md` - Project documentation

### Acceptance Criteria
- [ ] Angular 21 application successfully builds and serves on development port
- [ ] Material Design v21 theme matches coding-agent-frontend styling patterns
- [ ] All four main routes functional: `/`, `/smoke-tests`, `/admin/users`, `/login`
- [ ] WebSocket integration working with `/mastra-chat` and `/mastra-chat-history` namespaces
- [ ] Authentication flow complete with JWT token management and refresh
- [ ] User management CRUD operations working with backend API
- [ ] Responsive design works on mobile and desktop viewports
- [ ] Docker development and production containers build successfully
- [ ] Taskfile automation commands functional (start, stop, test, etc.)
- [ ] Unit test setup with Vitest configured and basic tests passing