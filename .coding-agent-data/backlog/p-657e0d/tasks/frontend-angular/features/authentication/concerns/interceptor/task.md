---
id: t-b5e6f7
parent: t-d7b9c2
created: 2026-01-26T18:12:00.000Z
updated: 2026-01-26T18:12:00.000Z
---

# Task: HTTP Interceptor

## Purpose
Create Angular HTTP interceptor to handle authentication errors, automatic token refresh, and HTTP cookie management for seamless API communication with the backend.

## Context

### Conventions
Follow Angular HTTP interceptor patterns:
- **Functional interceptor** using `HttpInterceptorFn` (Angular 15+ pattern)
- **Injectable interceptor class** for complex logic requiring dependency injection
- **HTTP error handling** with automatic retry on token refresh
- **Cookie management** with `withCredentials: true` for all authenticated requests
- **Response transformation** for consistent error messaging

Reference existing patterns:
- Angular HTTP interceptor documentation for functional and class-based approaches
- `projects/frontend/app/src/features/api-client/api-client.ts` - React HTTP client with cookie support
- Error handling patterns from React implementation

### Interfaces
```typescript
// Functional interceptor
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Add withCredentials and handle responses
};

// Injectable interceptor for complex logic
@Injectable()
export class AuthInterceptorService implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>>;
  private handleAuthError(error: HttpErrorResponse): Observable<never>;
  private retryWithTokenRefresh(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>>;
}
```

### Boundaries
- **Exposes**: HTTP request/response interceptor for authentication handling
- **Consumes**: AuthService for token refresh, error handling utilities
- **Constraints**:
  - Must set `withCredentials: true` for all requests to backend API
  - Must handle 401 responses with automatic token refresh
  - Must avoid infinite retry loops on auth failures
  - Must preserve original request context after token refresh

### References
- `projects/frontend/app/src/features/api-client/api-client.ts` - Cookie-based HTTP client implementation
- Angular HTTP interceptor patterns and error handling
- `projects/backend/app/src/features/keycloak-auth/controllers/keycloak-auth.controller.ts` - Expected error responses

## Specification

### Requirements
- Create HTTP interceptor to add credentials to all API requests
- Handle 401 Unauthorized responses with automatic token refresh
- Implement retry logic for failed requests after token refresh
- Prevent infinite retry loops on persistent auth failures
- Transform HTTP errors to user-friendly messages
- Support both functional and class-based interceptor patterns

### Files
- `src/app/features/authentication/interceptors/auth.interceptor.ts` - Main HTTP interceptor
- `src/app/features/authentication/interceptors/error-handler.service.ts` - Error transformation service
- `src/app/features/authentication/interceptors/index.ts` - Barrel export for interceptors

### Implementation Notes
- Add `withCredentials: true` to all requests to ensure cookies are sent
- On 401 error: attempt token refresh, then retry original request
- Use `defer()` and `switchMap()` for proper retry handling
- Track retry attempts to prevent infinite loops (max 1 retry per request)
- Transform HTTP errors: `{ message: error.error?.message || 'Request failed' }`
- Logout user if token refresh fails

### Acceptance Criteria
- [ ] All requests to backend include credentials for cookie-based auth
- [ ] 401 responses trigger automatic token refresh attempt
- [ ] Original request retried successfully after token refresh
- [ ] No infinite retry loops on persistent authentication failures
- [ ] Clear error messages provided for failed requests
- [ ] User logged out automatically when token refresh fails
- [ ] Interceptor registered in app configuration providers
- [ ] Compatible with both functional and class-based patterns