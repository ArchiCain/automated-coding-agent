---
id: t-2b3c4d
parent: t-a2d6e5
created: 2026-01-26T17:46:00.000Z
updated: 2026-01-26T17:46:00.000Z
---

# Task: API Client Service

## Purpose
Implement Angular HTTP client service with authentication interceptors, error handling, and request/response utilities that provide a consistent API layer for all features.

## Context

### Conventions
Follow Angular HTTP client patterns:
- **Injectable service** with `providedIn: 'root'` for singleton instance
- **HTTP interceptors** for auth token handling and error processing
- **RxJS observables** for all API methods returning typed responses
- **Environment configuration** for API base URL and timeout settings

Reference existing patterns:
- `projects/frontend/app/src/features/api-client/api-client.ts` - React axios patterns adapted for Angular
- `projects/coding-agent-frontend/app/src/app/features/claude-code-agent/services/` - Angular service patterns

### Interfaces
```typescript
// API client service interface
interface ApiClient {
  get<T>(url: string, options?: RequestOptions): Observable<T>;
  post<T>(url: string, body: any, options?: RequestOptions): Observable<T>;
  put<T>(url: string, body: any, options?: RequestOptions): Observable<T>;
  delete<T>(url: string, options?: RequestOptions): Observable<T>;
}

// Request configuration
interface RequestOptions {
  headers?: { [key: string]: string };
  params?: { [key: string]: string };
  withCredentials?: boolean;
  timeout?: number;
}

// Error response interface
interface ApiError {
  status: number;
  message: string;
  details?: any;
}
```

### Boundaries
- **Exposes**: HTTP client service, interceptors, and request/response utilities
- **Consumes**: Angular HTTP client, environment configuration, and authentication context
- **Constraints**: Must handle authentication tokens, provide error transformation, support request timeout

### References
- `projects/frontend/app/src/features/api-client/api-client.ts` - Axios client patterns for reference
- `projects/coding-agent-frontend/app/src/app/features/claude-code-agent/services/claude-code-agent.service.ts` - Angular HTTP service patterns

## Specification

### Requirements
- Implement HTTP client service with GET, POST, PUT, DELETE methods
- Create authentication interceptor for token handling
- Create error interceptor for consistent error transformation
- Provide request timeout and retry capabilities
- Support typed responses with generic methods

### Files
- `src/app/features/shared-ui/services/api-client.service.ts` - Main HTTP client service
- `src/app/features/shared-ui/interceptors/auth.interceptor.ts` - Authentication token interceptor
- `src/app/features/shared-ui/interceptors/error.interceptor.ts` - Error handling interceptor
- `src/app/features/shared-ui/models/api.models.ts` - API request/response interfaces
- `src/app/features/shared-ui/index.ts` - Public API exports

### Implementation Details
- Use Angular `HttpClient` with typed methods and RxJS operators
- Auth interceptor adds bearer token from localStorage/sessionStorage
- Error interceptor transforms HTTP errors to consistent ApiError format
- Support environment-based API base URL configuration
- Include request timeout with configurable default (30 seconds)

### Acceptance Criteria
- [ ] HTTP client service provides all CRUD methods with type safety
- [ ] Authentication interceptor properly handles bearer tokens
- [ ] Error interceptor provides consistent error transformation
- [ ] Requests timeout appropriately with configurable values
- [ ] Service integrates with Angular DI and can be injected by other features