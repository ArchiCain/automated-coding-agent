# Backend

NestJS API service — REST endpoints, WebSocket communication, database management, AI agent orchestration, and Keycloak authentication.

## Project Structure

```
projects/application/backend/
├── app/
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   └── features/
│   │       ├── cors/                    # CORS configuration
│   │       ├── health/                  # Health check endpoint
│   │       ├── keycloak-auth/           # JWT auth, RBAC, guards, decorators
│   │       ├── mastra-agents/           # AI agents, WebSocket chat gateways
│   │       ├── theme/                   # User theme preferences (light/dark)
│   │       ├── typeorm-database-client/ # PostgreSQL ORM, migrations, entities
│   │       └── user-management/         # User profile CRUD
│   ├── test/                            # Integration tests + helpers
│   ├── scripts/                         # start-dev.sh, start-prod.sh
│   ├── jest.config.js                   # Unit test config (*.spec.ts)
│   └── jest.integration.config.js       # Integration test config
├── dockerfiles/
│   ├── local.Dockerfile                 # Dev image with hot reload
│   └── prod.Dockerfile                  # Multi-stage production build
└── Taskfile.yml
```

## Features

| Feature | Purpose |
|---------|---------|
| **cors** | Environment-based CORS origin validation |
| **health** | Health check endpoint (`GET /health`) |
| **keycloak-auth** | JWT authentication, cookie-based sessions, `@Public()` and `@KeycloakUser()` decorators, permission guards |
| **mastra-agents** | AI agent orchestration (Anthropic, OpenAI, Google), WebSocket chat and chat history gateways |
| **theme** | User theme preferences with DTOs and validation |
| **typeorm-database-client** | PostgreSQL ORM, generic CRUD service, entities (base, example, user-theme), migrations |
| **user-management** | User profile and account management via Keycloak admin API |

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | No | Health check |
| `/auth/login` | POST | No | Login with credentials |
| `/auth/logout` | POST | Yes | End session |
| `/auth/check` | GET | Yes | Verify session, get profile |
| `/auth/refresh` | POST | No | Refresh access token |
| `/theme` | GET/PUT | Yes | Get/set user theme |
| `/users/me` | GET/PUT | Yes | Get/update current user |
| `/agents` | GET | Yes | List AI agents |
| `/agents/:id/run` | POST | Yes | Execute an agent |

WebSocket gateways provide real-time chat (`mastra-chat`) and chat history (`mastra-chat-history`) via Socket.io.

## Authentication

All routes are protected by default via a global `KeycloakJwtGuard`. Use `@Public()` to opt out. HTTP-only cookies manage JWT tokens — the frontend never touches tokens directly.

## Database

TypeORM with auto-run migrations on startup. Entities live in `features/typeorm-database-client/entities/`.

```bash
task backend:local:migration:generate -- CreateUserTable
task backend:local:migration:run
task backend:local:migration:revert
task backend:local:migration:show
```

## Tasks

```bash
task backend:local:start              # Start in Docker
task backend:local:run                # Run outside Docker (hot reload)
task backend:local:test               # Unit tests
task backend:local:test:integration   # Integration tests (requires stack)
task backend:local:lint               # ESLint
task backend:local:format             # Prettier
task backend:local:shell              # Shell into container
task backend:local:logs               # Tail logs
```

## Tech Stack

NestJS 11, TypeScript 5.9, TypeORM 0.3, PostgreSQL (pg 8.16), Keycloak Admin Client 26, jose 6 (JWT), Mastra 0.18 (AI agents), Socket.io 4.8, Jest 30, SWC (build).
