---
id: t-s7h2d9
parent: t-e9f4a3
created: 2026-01-26T18:26:00.000Z
updated: 2026-01-26T18:26:00.000Z
---

# Task: Service

## Purpose
Create Angular service for user management API integration, providing reactive methods for CRUD operations, list queries with pagination/search/sorting, and user status management.

## Context

### Conventions
Follow Angular service patterns:
- **Injectable decorator**: Use `@Injectable({ providedIn: 'root' })` for tree-shakable services
- **HTTP client**: Use Angular HttpClient for API requests
- **RxJS observables**: Return observables for all async operations
- **Error handling**: Use catchError operator with user-friendly error messages
- **Type safety**: Strongly typed methods with interfaces matching API contracts

Reference API patterns from backend:
- `projects/backend/app/src/features/user-management/controllers/user-management.controller.ts` - Complete endpoint specification
- Base URL pattern: `/api/users` with standard REST endpoints
- Permission requirements: All endpoints require specific user permissions

### Interfaces
```typescript
// Service method signatures
interface UserManagementService {
  getUsers(query: UserListQuery): Observable<UserListResponse>;
  getUserById(id: string): Observable<User>;
  createUser(request: CreateUserRequest): Observable<User>;
  updateUser(id: string, request: UpdateUserRequest): Observable<User>;
  deleteUser(id: string): Observable<{ message: string }>;
  toggleUserEnabled(id: string, enabled: boolean): Observable<User>;
}

// HTTP request configuration
interface ApiRequestConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
}
```

### Boundaries
- **Exposes**: Observable-based methods for all user management operations
- **Consumes**: Angular HttpClient, environment configuration for API base URL
- **Constraints**:
  - Must handle authentication tokens automatically via HTTP interceptors
  - Must implement proper error handling with typed error responses
  - Must support query parameters for pagination, search, and sorting
  - Must transform API responses to match frontend interfaces

### References
- `projects/frontend/app/src/features/user-management/services/user-management.api.ts` - React API service patterns
- `projects/backend/app/src/features/user-management/controllers/user-management.controller.ts` - API endpoint contracts
- Angular HttpClient documentation for RESTful API integration

## Specification

### Requirements
- Create Angular service with all user CRUD operations
- Implement list method with pagination, search, and sorting support
- Handle API authentication through HTTP interceptors
- Implement proper error handling and loading states
- Support reactive programming patterns with RxJS operators
- Provide type-safe methods matching backend API contracts

### Files
- `src/features/user-management/services/user-management.service.ts` - Main service implementation
- `src/features/user-management/services/user-management.service.spec.ts` - Service unit tests

### Acceptance Criteria
- [ ] Service provides getUsers() method with UserListQuery parameter support
- [ ] Service provides getUserById() method for single user retrieval
- [ ] Service provides createUser() method with CreateUserRequest validation
- [ ] Service provides updateUser() method with partial UpdateUserRequest
- [ ] Service provides deleteUser() method with confirmation
- [ ] Service provides toggleUserEnabled() method for status changes
- [ ] All methods return typed observables matching API response interfaces
- [ ] Error handling provides user-friendly error messages
- [ ] HTTP interceptors handle authentication tokens automatically
- [ ] Service is properly injectable and tree-shakable
- [ ] Query parameters are correctly encoded for pagination and search
- [ ] Service methods can be easily mocked for testing