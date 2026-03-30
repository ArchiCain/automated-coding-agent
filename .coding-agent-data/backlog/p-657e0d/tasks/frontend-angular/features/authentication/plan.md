---
id: t-d7b9c2
parent: t-a9f3e2
created: 2026-01-26T17:46:00.000Z
updated: 2026-01-26T18:12:00.000Z
---

# Plan: Authentication Feature

## Purpose
Implement complete JWT-based authentication system with login forms, token management, route guards, and automatic session handling using Angular reactive forms and HTTP-only cookie integration.

## Context

### Conventions
Follow Angular 21 authentication patterns:
- **Reactive forms** with Material form controls for login
- **HTTP interceptors** for automatic token refresh
- **Route guards** for protected routes with permission checking
- **RxJS observables** for authentication state management
- **HTTP-only cookies** for secure token storage (no localStorage)

Reference existing patterns:
- `projects/backend/app/src/features/keycloak-auth/controllers/keycloak-auth.controller.ts` - API endpoints structure
- `projects/frontend/app/src/features/keycloak-auth/` - React authentication patterns to port

### Interfaces
```typescript
// Authentication API interfaces
interface LoginRequest {
  username: string;
  password: string;
}

interface AuthUser {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
}

interface AuthResponse {
  message: string;
  user: AuthUser;
}

// Service interfaces
interface AuthService {
  login(credentials: LoginRequest): Observable<AuthUser>;
  logout(): Observable<void>;
  checkAuth(): Observable<AuthUser>;
  refreshToken(): Observable<void>;
  getCurrentUser(): Observable<AuthUser | null>;
}

// Guard interfaces
interface PermissionGuard {
  canActivate(route: ActivatedRouteSnapshot): Observable<boolean>;
  requiredPermissions: string[];
}
```

### Boundaries
- **Exposes**: Login page at `/login` route, authentication guards, and user context service
- **Consumes**: Backend auth endpoints `/auth/login`, `/auth/logout`, `/auth/refresh`, `/auth/check`
- **Constraints**:
  - Must use HTTP-only cookies (no client-side token storage)
  - Must implement 30-minute inactivity timeout with automatic logout
  - Must proactively refresh tokens 4 minutes before expiry
  - Must support permission-based route protection (`users:read` for admin)

### References
- `projects/backend/app/src/features/keycloak-auth/controllers/keycloak-auth.controller.ts` - All auth endpoints
- `projects/frontend/app/src/features/keycloak-auth/` - React auth implementation patterns
- `projects/frontend/app/src/App.tsx` - Protected route structure with ProtectedRoute component

## Children

| Name | Path | Description |
|------|------|-------------|
| Authentication Types | ./concerns/types/task.md | TypeScript interfaces for authentication data structures |
| Authentication Service | ./concerns/service/task.md | Injectable service with RxJS state management and session handling |
| Route Guards | ./concerns/guard/task.md | Authentication and permission-based route protection |
| HTTP Interceptor | ./concerns/interceptor/task.md | Cookie management and automatic token refresh |
| Login Page | ./concerns/page/task.md | Material Design login form with reactive form validation |
| Authentication Tests | ./concerns/test/task.md | Unit and integration tests for authentication functionality |