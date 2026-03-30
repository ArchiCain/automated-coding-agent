---
id: t-x8v2y1
parent: t-e9f4a3
created: 2026-01-26T18:26:00.000Z
updated: 2026-01-26T18:26:00.000Z
---

# Task: Types

## Purpose
Create TypeScript interfaces and types for user management feature, ensuring type safety across components, services, and API interactions while maintaining compatibility with backend contracts.

## Context

### Conventions
Follow TypeScript interface patterns:
- **Interface definitions**: Use interfaces for object shapes and contracts
- **Type aliases**: Use type unions for enums and literal types
- **API compatibility**: Match backend DTO interfaces exactly
- **Export strategy**: Export all types for feature consumption
- **Documentation**: Include JSDoc comments for complex interfaces

Reference existing type patterns:
- `projects/frontend/app/src/features/user-management/types.ts` - React type definitions to port
- `projects/backend/app/src/features/user-management/user-management.types.ts` - Backend API contracts
- Ensure frontend interfaces match backend DTOs exactly

### Interfaces
```typescript
// Core user interfaces (match backend DTOs)
interface User {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  createdTimestamp?: number;
  roles: Role[];
}

// Request/response interfaces
interface CreateUserRequest {
  email: string;
  firstName?: string;
  lastName?: string;
  temporaryPassword: string;
  role: Role;
}

interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  role?: Role;
}

// Pagination and sorting interfaces
interface UserListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: UserSortField;
  sortDirection?: SortDirection;
}

interface UserListResponse {
  users: User[];
  pagination: PaginationMeta;
}
```

### Boundaries
- **Exposes**: All TypeScript interfaces and types for the user management feature
- **Consumes**: Role and Permission types from authentication feature
- **Constraints**:
  - Must maintain strict compatibility with backend API contracts
  - Must provide comprehensive type coverage for all feature components
  - Must support generic pagination and sorting patterns
  - Must be easily importable by other feature components

### References
- `projects/frontend/app/src/features/user-management/types.ts` - Existing React type definitions
- `projects/backend/app/src/features/user-management/user-management.types.ts` - Backend DTO interfaces
- `projects/frontend/app/src/features/keycloak-auth/permissions/permissions.types.ts` - Role and Permission types

## Specification

### Requirements
- Create comprehensive TypeScript interfaces for user management domain
- Ensure compatibility with backend API contracts and DTOs
- Define request/response interfaces for all API operations
- Implement pagination, sorting, and query parameter types
- Provide form value interfaces for component integration
- Include proper JSDoc documentation for complex types

### Files
- `src/features/user-management/types/user.types.ts` - Core user interface definitions
- `src/features/user-management/types/api.types.ts` - API request/response interfaces
- `src/features/user-management/types/form.types.ts` - Form value and validation types
- `src/features/user-management/types/index.ts` - Centralized exports for all types

### Acceptance Criteria
- [ ] User interface matches backend UserDto exactly
- [ ] CreateUserRequest interface matches backend CreateUserDto
- [ ] UpdateUserRequest interface matches backend UpdateUserDto
- [ ] UserListQuery interface supports all filtering and sorting options
- [ ] UserListResponse interface includes users array and pagination metadata
- [ ] PaginationMeta interface provides page, pageSize, total, and totalPages
- [ ] SortDirection type supports 'asc' and 'desc' values
- [ ] UserSortField type includes all sortable column names
- [ ] ToggleUserEnabledRequest interface matches backend requirements
- [ ] Form value interfaces support both create and edit modes
- [ ] All interfaces have proper JSDoc documentation
- [ ] Types are properly exported through index file for easy import
- [ ] Types integrate seamlessly with Angular reactive forms
- [ ] Types support proper IntelliSense and IDE autocompletion