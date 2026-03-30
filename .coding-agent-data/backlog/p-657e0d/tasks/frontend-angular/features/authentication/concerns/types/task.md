---
id: t-e8f2a1
parent: t-d7b9c2
created: 2026-01-26T18:12:00.000Z
updated: 2026-01-26T18:12:00.000Z
---

# Task: Authentication Types

## Purpose
Define TypeScript interfaces and types for authentication, matching the backend API contracts and providing type safety for the Angular authentication system.

## Context

### Conventions
Follow Angular TypeScript patterns:
- **Interface definitions** in dedicated types files
- **Consistent naming** matching backend API response structure
- **Export all interfaces** for feature-wide use
- **Type unions** for authentication states and permissions
- **Generic types** for API responses

Reference existing patterns:
- `projects/frontend/app/src/features/keycloak-auth/types.ts` - React types to port to Angular
- `projects/backend/app/src/features/keycloak-auth/controllers/keycloak-auth.controller.ts` - Backend response structure

### Interfaces
```typescript
// Core authentication types
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

// Service state interface
interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  permissions: Permission[];
}
```

### Boundaries
- **Exposes**: TypeScript interfaces for all authentication data structures
- **Consumes**: Nothing (pure type definitions)
- **Constraints**: Must match backend API contracts exactly, especially AuthUser and LoginRequest structures

### References
- `projects/frontend/app/src/features/keycloak-auth/types.ts` - React types showing required interfaces
- `projects/backend/app/src/features/keycloak-auth/controllers/keycloak-auth.controller.ts` - Backend API response shapes

## Specification

### Requirements
- Define all authentication data interfaces matching backend API contracts
- Create permission and role types for authorization system
- Include authentication state interface for service observables
- Export all types for feature-wide consumption

### Files
- `src/app/features/authentication/types/auth.types.ts` - Main authentication interfaces
- `src/app/features/authentication/types/permission.types.ts` - Permission and role definitions
- `src/app/features/authentication/types/index.ts` - Barrel export for all types

### Acceptance Criteria
- [ ] LoginRequest interface matches backend endpoint expectations
- [ ] AuthUser interface matches backend response structure exactly
- [ ] AuthResponse interface includes message and user fields
- [ ] Permission types support role-based access control
- [ ] AuthState interface provides observable state structure for service
- [ ] All types exported through barrel index file
- [ ] TypeScript compilation passes without errors