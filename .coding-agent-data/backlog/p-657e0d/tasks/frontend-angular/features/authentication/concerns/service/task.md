---
id: t-f9d3b2
parent: t-d7b9c2
created: 2026-01-26T18:12:00.000Z
updated: 2026-01-26T18:12:00.000Z
---

# Task: Authentication Service

## Purpose
Create injectable Angular authentication service with RxJS observables for state management, HTTP cookie-based authentication, automatic token refresh, and 30-minute inactivity timeout.

## Context

### Conventions
Follow Angular service patterns:
- **Injectable service** with `@Injectable({ providedIn: 'root' })`
- **RxJS BehaviorSubjects** for reactive state management
- **HTTP client** with cookie support (no manual token handling)
- **Timer-based refresh** 4 minutes before token expiry
- **Activity tracking** with automatic logout on 30-minute inactivity

Reference existing patterns:
- `projects/frontend/app/src/features/keycloak-auth/hooks/use-auth.tsx` - React auth provider logic to port
- `projects/frontend/app/src/features/keycloak-auth/services/auth.api.ts` - API service implementation
- `projects/coding-agent-frontend/app/src/app/features/*/services/*.service.ts` - Angular service patterns

### Interfaces
```typescript
@Injectable({ providedIn: 'root' })
export class AuthService {
  // State observables
  private userSubject = new BehaviorSubject<AuthUser | null>(null);
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);

  // Public observables
  user$ = this.userSubject.asObservable();
  isAuthenticated$ = computed(() => !!this.userSubject.value);
  isLoading$ = this.isLoadingSubject.asObservable();
  error$ = this.errorSubject.asObservable();

  // Methods
  login(credentials: LoginRequest): Observable<AuthUser>;
  logout(): Observable<void>;
  checkAuth(): Observable<AuthUser | null>;
  refreshToken(): Observable<void>;
  getCurrentUser(): Observable<AuthUser | null>;
  startSessionManagement(): void;
  stopSessionManagement(): void;
}
```

### Boundaries
- **Exposes**: Authentication state observables, login/logout methods, session management
- **Consumes**: HTTP client for API calls, authentication types, permission system
- **Constraints**:
  - Must use HTTP-only cookies (no localStorage/sessionStorage)
  - Must implement proactive token refresh 4 minutes before expiry
  - Must logout user automatically after 30 minutes of inactivity
  - Must track user activity events (mouse, keyboard, touch, scroll)

### References
- `projects/frontend/app/src/features/keycloak-auth/services/auth.api.ts` - API endpoint implementations
- `projects/frontend/app/src/features/keycloak-auth/hooks/use-auth.tsx` - Session management and activity tracking logic
- `projects/backend/app/src/features/keycloak-auth/controllers/keycloak-auth.controller.ts` - Backend API contracts

## Specification

### Requirements
- Create injectable AuthService with RxJS state management
- Implement login, logout, checkAuth, and refreshToken methods
- Add automatic token refresh timer (4 minutes before expiry)
- Implement 30-minute inactivity timeout with activity tracking
- Handle HTTP errors and provide clear error messages
- Support permission calculation from user roles
- Initialize authentication state on app startup

### Files
- `src/app/features/authentication/services/auth.service.ts` - Main authentication service
- `src/app/features/authentication/services/session-manager.service.ts` - Activity tracking and timers
- `src/app/features/authentication/services/permission.service.ts` - Role-to-permission mapping
- `src/app/features/authentication/services/index.ts` - Barrel export for services

### Implementation Notes
- Use `HttpClient.post()` with `{ withCredentials: true }` for cookie support
- Activity events: `['mousedown', 'keydown', 'touchstart', 'scroll']`
- Token refresh timer: Set for 4 minutes before expiry (backend provides expiresIn)
- Inactivity logout: Clear all state and redirect to login
- Error handling: Transform HTTP errors to user-friendly messages

### Acceptance Criteria
- [ ] AuthService provides reactive observables for authentication state
- [ ] Login method calls `/auth/login` and updates user state
- [ ] Logout method calls `/auth/logout` and clears all state
- [ ] CheckAuth method validates current authentication status
- [ ] Token refresh works automatically with timer-based scheduling
- [ ] 30-minute inactivity timeout logs out user automatically
- [ ] Activity tracking resets inactivity timer on user interaction
- [ ] Permission calculation works correctly from user roles
- [ ] Service initializes authentication state on app bootstrap