# Frontend Overview

Angular frontend for the RTS AI Platform — authentication, user management, real-time chat, and admin tools.

## Architecture

```
frontend (Angular on :4200 dev / :8080 prod via nginx)
    |
    |--> REST API (HttpClient + interceptors)
    |       --> backend (NestJS on :8085)
    |
    |--> WebSocket (Socket.io)
    |       --> backend (NestJS on :8085)
    |
    |--> Auth
            --> keycloak (on :8081)
```

## Tech stack

Angular 19, Angular Material, TypeScript 5.8+, RxJS, SCSS, Jest, ESLint, Prettier

## Project structure

```
projects/application/frontend/
├── app/                            # Angular CLI project root
│   ├── src/
│   │   ├── app/
│   │   │   ├── app.component.ts    # Shell: <router-outlet>
│   │   │   ├── app.config.ts       # Providers: router, http, animations
│   │   │   ├── app.routes.ts       # Top-level lazy-loaded routes
│   │   │   └── features/           # All application code
│   │   │       ├── api-client/     # Shared: HttpClient, interceptors, WebSocket
│   │   │       ├── app-header/     # Shared: top bar, avatar menu
│   │   │       ├── chat/           # Full-stack: real-time chat UI
│   │   │       ├── keycloak-auth/  # Full-stack: auth, guards, login
│   │   │       ├── layouts/        # Shared: responsive app layout
│   │   │       ├── navigation/     # Shared: sidebar, drawer, tree
│   │   │       ├── navigation-config/ # Shared: menu structure data
│   │   │       ├── shared/         # Shared: confirmation modal, common pipes
│   │   │       ├── testing-tools/  # Full-stack: smoke tests, health checks
│   │   │       ├── theme/          # Shared: dark/light toggle
│   │   │       └── user-management/ # Full-stack: admin CRUD
│   │   ├── styles/                 # Global SCSS + Angular Material themes
│   │   └── index.html
│   ├── angular.json                # Build/test/lint config
│   ├── tsconfig.json
│   ├── jest.config.ts
│   └── package.json
├── dockerfiles/
│   ├── local.Dockerfile            # Dev: ng serve with hot reload
│   └── prod.Dockerfile             # Prod: multi-stage build + nginx
├── chart/                          # Helm chart
└── Taskfile.yml                    # Build/test/deploy automation
```

## Key decisions

### Standalone components with feature modules

All components are standalone (`standalone: true`). Each feature has an NgModule that imports and re-exports its public components, making them available to other features. This balances modern Angular (standalone) with clean organization (modules as public API).

### State management: Signals + RxJS

- **Signals** for synchronous state (auth status, theme, layout breakpoints, form state)
- **RxJS** for async streams (HTTP responses, WebSocket messages, timer-based token refresh)
- No external state management library needed

### Dependency injection: `inject()` function

Use the `inject()` function instead of constructor injection. Cleaner syntax, better tree-shaking, works with standalone components.

### Reactive forms only

All forms use Angular's `ReactiveFormsModule`. Template-driven forms are not used anywhere in this project.

### Runtime configuration

Environment config is loaded at runtime from `/config.json` (served by nginx), not baked in at build time. This means the same Docker image works in any environment. The `AppConfigService` holds the loaded config and is injected wherever needed.

### No-defaults policy

Environment variables and runtime config values must never have default fallbacks. If a required value is missing, the app fails immediately at startup with a clear error message. See [Environment Configuration](../../architecture/environment-configuration.md).

## File naming conventions

| Type | Pattern | Example |
|------|---------|---------|
| Directories | `kebab-case` | `user-management/` |
| Route pages | `*.page.ts` | `users.page.ts` |
| Components | `*.component.ts` | `users-table.component.ts` |
| Services | `*.service.ts` | `auth.service.ts` |
| Guards | `*.guard.ts` | `auth.guard.ts` |
| Interceptors | `*.interceptor.ts` | `auth.interceptor.ts` |
| Directives | `*.directive.ts` | `require-permission.directive.ts` |
| Pipes | `*.pipe.ts` | `truncate.pipe.ts` |
| Types | `types.ts` | `types.ts` |
| Module | `feature-name.module.ts` | `keycloak-auth.module.ts` |
| Barrel | `index.ts` | `index.ts` |
| Tests | `*.spec.ts` | `auth.service.spec.ts` |
| Templates | `*.component.html` | `login-form.component.html` |
| Styles | `*.component.scss` | `login-form.component.scss` |

## Routes

| Path | Component | Auth | Feature |
|------|-----------|------|---------|
| `/login` | LoginPage | No | keycloak-auth |
| `/` | redirect to `/smoke-tests` | Yes | - |
| `/smoke-tests` | SmokeTestsPage | Yes | testing-tools |
| `/admin/users` | UsersPage | Yes | user-management |
| `/admin/users/new` | UserPage | Yes | user-management |
| `/admin/users/:id` | UserPage | Yes | user-management |
| `/chat` | ChatPage | Yes | chat |

## Common tasks

```bash
task frontend:local:run                # ng serve (dev server)
task frontend:local:test               # Jest unit tests
task frontend:local:test:coverage      # Jest with coverage (80% threshold)
task frontend:local:lint               # ESLint
task frontend:local:type-check         # TypeScript check
task frontend:local:build              # ng build (production)
```

## Related docs

- [Angular Standards](angular-standards.md)
- [Testing Standards](testing-standards.md)
- [API Integration](api-integration.md)
- [Linting & Formatting](linting.md)
- [Design Guide](../../../design/design-guide.md)
- [Feature Architecture](../../../architecture/feature-architecture.md)
