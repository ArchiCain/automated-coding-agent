# Keycloak

Centralized authentication and authorization service using cookie-based session management.

## Architecture

```
frontend ──POST /auth/login──→ backend ──token exchange──→ keycloak
                                  │
                          sets HTTP-only cookies
                                  │
frontend ←── user profile ────────┘
```

The frontend never talks to Keycloak directly. The backend acts as an auth proxy: it exchanges credentials with Keycloak, validates JWTs, and manages token lifecycle via HTTP-only cookies.

## Authentication flow

### Login

1. User submits credentials to `POST /auth/login` on backend
2. Backend exchanges credentials with Keycloak for JWT tokens
3. Backend sets `access_token` and `refresh_token` as HTTP-only cookies
4. Backend returns user profile to frontend

### Protected route access

1. Browser sends cookies automatically with each request
2. Backend `KeycloakJwtGuard` extracts and validates the token
3. Route handler accesses user via `@KeycloakUser()` decorator

### Token refresh

1. Backend detects expired access token
2. Exchanges refresh token with Keycloak for new tokens
3. Updates cookies transparently

### Logout

1. Frontend calls `POST /auth/logout`
2. Backend invalidates Keycloak session and clears cookies

## Test users

Pre-configured in the `application` realm:

| Username | Password | Roles |
|----------|----------|-------|
| `admin` | `admin` | `user`, `admin` |
| `testuser` | `password` | `user` |

## Configuration

| Variable | Description |
|----------|-------------|
| `KEYCLOAK_REALM` | Realm name (`application`) |
| `KEYCLOAK_CLIENT_ID` | Backend client ID (`backend-service`) |
| `KEYCLOAK_CLIENT_SECRET` | Client secret |
| `KEYCLOAK_ADMIN_PASSWORD` | Admin console password |

## Realm configuration

The realm is defined in `projects/keycloak/app/realm-config/realm-export.json` and auto-imported on startup. It includes:

- **Realm**: `application`
- **Client**: `backend-service` (confidential, with client secret)
- **Roles**: `user` (default), `admin`
- **Protocol mappers**: email and roles included in JWT

Environment variables in the realm config (e.g., `${FRONTEND_URL}`) are substituted at startup via `envsubst`.

## Database schema

Keycloak uses a dedicated `keycloak` schema in the shared PostgreSQL database. The startup script creates the schema (`CREATE SCHEMA IF NOT EXISTS keycloak`), and Keycloak manages its tables via Liquibase migrations.

## Backend integration

```typescript
// All routes protected by default (global guard)
@Controller('api/data')
export class DataController {
  @Get()
  getData(@KeycloakUser() user: KeycloakUserProfile) {
    return { userId: user.id };
  }

  @Public()   // Opt out of auth
  @Get('status')
  getStatus() { return { status: 'ok' }; }
}
```

## Frontend integration

```typescript
import { useAuth } from '../features/keycloak-auth';

function Profile() {
  const { user, isAuthenticated, logout } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  return <button onClick={logout}>Logout {user.username}</button>;
}
```

## API endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/auth/login` | POST | No | Login with username/password |
| `/auth/logout` | POST | Yes | End session |
| `/auth/check` | GET | Yes | Verify auth, return profile |
| `/auth/refresh` | POST | No | Refresh access token (uses cookie) |

## Admin console

Available at `http://localhost:8081/admin/` with admin/admin credentials.
