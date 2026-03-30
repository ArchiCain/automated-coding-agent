# Keycloak Authentication

Centralized authentication and authorization using Keycloak with cookie-based session management.

## Authentication Philosophy

The template uses a **backend-proxied authentication approach** with Keycloak:

- **Cookie-Based Sessions**: Backend manages authentication via HTTP-only cookies (no direct Keycloak SDK in frontend)
- **Backend as Auth Proxy**: Backend validates JWTs and manages token lifecycle
- **API-Only Keycloak**: Keycloak runs as a service without user-facing admin UI
- **Global Protection**: All routes protected by default, public routes explicitly marked
- **Role-Based Access Control**: User permissions managed through Keycloak realm and client roles

### Security-First Design

- **HTTP-Only Cookies**: Prevents XSS attacks by keeping tokens inaccessible to JavaScript
- **SameSite Policy**: CSRF protection through cookie policy
- **Automatic Refresh**: Token refresh handled transparently by backend
- **Guard-Based Authorization**: Global guard protects all routes, decorators override when needed

## Architecture Components

### Keycloak Service

The Keycloak service provides centralized identity management:

- **Shared Database**: Uses PostgreSQL with separate `keycloak` schema
- **Custom Docker Build**: Includes `psql` for database schema initialization
- **Realm Auto-Import**: Pre-configured realm with clients, roles, and test users
- **Schema Management**: Startup script creates schema, Keycloak manages via Liquibase

### Backend Integration (`keycloak-auth` package)

Self-contained authentication package in NestJS backend:

```
packages/keycloak-auth/
├── keycloak-auth.module.ts       # NestJS module
├── keycloak-auth.service.ts      # Token management and validation
├── keycloak-auth.controller.ts   # Auth API endpoints
├── keycloak-jwt.guard.ts         # Global JWT guard
├── keycloak-types.ts             # TypeScript interfaces
└── decorators/
    ├── public.decorator.ts       # @Public() - bypass auth
    └── keycloak-user.decorator.ts # @KeycloakUser() - extract user
```

**Key Features**:
- Login, logout, token refresh, session validation
- JWT decoding and user profile extraction
- HTTP-only cookie management
- Global guard applied to all routes

### Frontend Integration (`keycloak-auth` package)

Self-contained authentication package in React frontend:

```
packages/keycloak-auth/
├── hooks/
│   └── use-auth.tsx              # AuthProvider + useAuth hook
├── components/
│   ├── login.tsx                 # Login page
│   ├── login-form.tsx            # Login form component
│   └── protected-route.tsx       # Route protection wrapper
├── services/
│   └── auth.api.ts               # API client for auth endpoints
└── types.ts                      # TypeScript interfaces
```

**Key Features**:
- React Context for auth state
- Protected route wrapper with role support
- Automatic authentication check on mount
- Login/logout workflows

## Authentication Flow

### Login Flow

1. User submits credentials via frontend login form
2. Frontend calls `POST /auth/login` on backend
3. Backend exchanges credentials with Keycloak for JWT tokens
4. Backend validates token and extracts user profile
5. Backend sets HTTP-only cookies (`access_token`, `refresh_token`)
6. Backend returns user profile to frontend
7. Frontend updates auth state and redirects to protected route

### Protected Route Access

1. User navigates to protected route
2. Request includes cookies automatically
3. Backend `KeycloakJwtGuard` extracts token from cookie
4. Guard validates token and attaches user to request
5. Route handler accesses user via `@KeycloakUser()` decorator
6. Response sent to frontend

### Token Refresh

1. Backend detects expired access token
2. Backend exchanges refresh token with Keycloak for new tokens
3. Backend updates cookies with new tokens
4. Request proceeds with fresh token

### Logout Flow

1. User triggers logout
2. Frontend calls `POST /auth/logout`
3. Backend invalidates session with Keycloak
4. Backend clears cookies
5. Frontend clears auth state and redirects to login

## Implementation Patterns

### Backend: Protecting Routes

**Global Protection (Default)**:
```typescript
@Controller('api/data')
export class DataController {
  @Get()
  getData(@KeycloakUser() user: KeycloakUserProfile) {
    // User is authenticated, access user profile
    return { data: 'protected', userId: user.id };
  }
}
```

**Public Routes**:
```typescript
@Controller('api/public')
export class PublicController {
  @Public()  // Bypass authentication
  @Get('status')
  getStatus() {
    return { status: 'ok' };
  }
}
```

**Role-Based Access**:
```typescript
@Get('settings')
getSettings(@KeycloakUser() user: KeycloakUserProfile) {
  if (!user.roles.includes('admin')) {
    throw new ForbiddenException('Admin access required');
  }
  return { settings: '...' };
}
```

### Frontend: Protecting Routes

**Route Protection**:
```typescript
import { ProtectedRoute } from './packages/keycloak-auth';

<Routes>
  <Route path="/login" element={<Login />} />

  <Route
    path="/dashboard"
    element={
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    }
  />

  <Route
    path="/admin"
    element={
      <ProtectedRoute requiredRoles={['admin']}>
        <AdminPanel />
      </ProtectedRoute>
    }
  />
</Routes>
```

**Using Auth State**:
```typescript
import { useAuth } from './packages/keycloak-auth';

function UserProfile() {
  const { user, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" />;

  return (
    <div>
      <p>Welcome, {user.username}!</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

## Configuration

### Environment Variables

**Required in root `.env`**:

```bash
# Keycloak Service
KEYCLOAK_PORT=8081
KEYCLOAK_ADMIN_PASSWORD=admin

# Backend Keycloak Integration
KEYCLOAK_BASE_URL=http://keycloak:8080  # Docker: service name
KEYCLOAK_REALM=application
KEYCLOAK_CLIENT_ID=backend-service
KEYCLOAK_CLIENT_SECRET=backend-service-secret

# Frontend URL (for realm config)
FRONTEND_URL=http://localhost:3000
```

### Realm Configuration

The realm is defined in `projects/keycloak/app/realm-config/realm-export.json`:

**Key Components**:
- **Realm**: `application`
- **Clients**: `backend-service` (confidential client with secret)
- **Roles**: `user` (default), `admin`
- **Users**: Pre-configured test users
- **Protocol Mappers**: Include email, roles in JWT

**Environment Variable Substitution**: Variables like `${FRONTEND_URL}` are substituted by startup script using `envsubst`.

## Local Development

### Starting Services

```bash
# Start full stack (includes Keycloak)
task start-local

# Check Keycloak health
curl http://localhost:8081/health
```

### Test Users

Pre-configured users in the `application` realm:

| Username | Password | Roles |
|----------|----------|-------|
| `admin` | `admin` | `user`, `admin` |
| `testuser` | `password` | `user` |

### Testing Authentication

```bash
# Login
curl -X POST http://localhost:8085/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin"}' \
  -c cookies.txt

# Check authentication
curl http://localhost:8085/auth/check -b cookies.txt

# Logout
curl -X POST http://localhost:8085/auth/logout -b cookies.txt
```

## Production Deployment

### Infrastructure

Keycloak deploys as an ECS Fargate service (see [Terraform](terraform.md) for details):

- **Database**: RDS PostgreSQL with separate `keycloak` schema
- **Service Discovery**: `keycloak.local:8080` for backend communication
- **SSL**: External traffic via ALB with ACM certificate
- **Custom Domain**: `https://auth.${DNS_POSTFIX}.rtsdev.co`

### Database Configuration

**Production** uses RDS with SSL:
- JDBC URL includes `sslmode=require`
- Credentials from Secrets Manager
- SSL enabled for all connections

**Local Development** uses Docker database without SSL:
- JDBC URL includes `sslmode=disable`
- Credentials from `.env`

### Deployment Commands

```bash
# Deploy Keycloak to AWS
task keycloak:dev:deploy

# View logs
task keycloak:dev:logs

# Get service URL
task keycloak:dev:get-url
```

### Backend Configuration

Backend connects via service discovery:

```bash
KEYCLOAK_BASE_URL=http://keycloak.local:8080
KEYCLOAK_REALM=application
KEYCLOAK_CLIENT_ID=backend-service
KEYCLOAK_CLIENT_SECRET=<from Secrets Manager>
```

## Database Schema Management

### Schema Isolation

Keycloak uses a **dedicated schema** in the shared PostgreSQL database:

| Schema | Owner | Purpose |
|--------|-------|---------|
| `keycloak` | Keycloak | User accounts, sessions, realm config |
| `example_schema` | Backend | Application data |
| `mastra` | Backend/Mastra | AI agent data |

### Schema Creation

The Keycloak startup script creates the schema before Keycloak starts:

```bash
psql -c "CREATE SCHEMA IF NOT EXISTS keycloak;"
```

Keycloak then manages the schema via its own Liquibase migrations.

## API Endpoints

### Authentication Endpoints

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/auth/login` | POST | No | Username/password login |
| `/auth/logout` | POST | Yes | Invalidate session and clear cookies |
| `/auth/check` | GET | Yes | Verify authentication and get user profile |
| `/auth/refresh` | POST | No (uses cookie) | Refresh access token |

## Best Practices

### Backend Development

- **Use @Public() sparingly**: Only for truly public endpoints
- **Extract user via decorator**: Use `@KeycloakUser()` instead of accessing `request.user`
- **Validate roles in handlers**: Guard checks authentication, handlers check authorization
- **Never hardcode secrets**: Use environment variables for client secrets
- **Trust the guard**: If request reaches handler, user is authenticated

### Frontend Development

- **Wrap app in AuthProvider**: Must be at root level for context to work
- **Use ProtectedRoute consistently**: Clear boundaries between protected/public routes
- **Handle loading states**: Auth check happens asynchronously on mount
- **Don't store tokens**: Backend manages cookies, frontend just makes API calls
- **Check roles before rendering**: Use `user.roles.includes('admin')` for conditional UI

### Security Considerations

- **HTTP-Only Cookies**: Tokens never accessible to JavaScript (XSS protection)
- **SameSite Policy**: Cookies only sent to same-origin (CSRF protection)
- **Token Expiration**: Access tokens expire quickly, refresh tokens in days
- **Role Validation**: Always validate roles on backend, never trust frontend
- **HTTPS in Production**: Cookies marked secure over HTTPS

### Configuration Management

- **No Defaults Policy**: All environment variables must be in `.env`
- **Single Source of Truth**: Root `.env` contains all sensitive configuration
- **Realm Export**: Keep `realm-export.json` in version control (no secrets)
- **Environment Substitution**: Use `${VAR}` in realm config for environment-specific values

## Common Issues

**Login fails**:
- Verify Keycloak is running and backend can reach it
- Check `KEYCLOAK_BASE_URL` matches container name or service discovery address
- Verify test users exist in realm config

**Protected routes redirect to login**:
- Check cookies are being set (browser DevTools → Application → Cookies)
- Verify CORS allows credentials (`credentials: true`)
- Ensure `cookie-parser` middleware installed

**Token validation fails**:
- Check token hasn't expired
- Verify backend `KEYCLOAK_REALM` matches token realm
- Ensure Keycloak service is healthy

**Schema creation fails**:
- Check database is accessible from Keycloak container
- Verify database user has permission to create schemas
- Review Keycloak logs for details

## Related Documentation

- **Package Architecture**: [Package Architecture](package-architecture.md) - Self-contained package patterns
- **Environment Configuration**: [Environment Configuration](environment-configuration.md) - Config management and no-defaults policy
- **Testing**: [Testing](testing.md) - Authentication testing patterns
- **Terraform**: [Terraform](terraform.md) - Keycloak service infrastructure deployment

---

This authentication system provides production-ready security with a developer-friendly API, balancing security best practices with ease of use for local development and testing.
