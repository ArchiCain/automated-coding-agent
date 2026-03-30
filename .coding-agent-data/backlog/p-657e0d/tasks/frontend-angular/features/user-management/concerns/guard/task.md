---
id: t-g4k8j3
parent: t-e9f4a3
created: 2026-01-26T18:26:00.000Z
updated: 2026-01-26T18:26:00.000Z
---

# Task: Guard

## Purpose
Create Angular route guard that protects user management routes by verifying users have the required `users:read` permission before allowing access to the admin interface.

## Context

### Conventions
Follow Angular guard patterns:
- **CanActivate**: Implement CanActivate interface for route protection
- **Injectable guard**: Use functional guards (Angular 15+) or class-based guards
- **Permission service**: Integration with permission/authentication service for access checks
- **Router navigation**: Redirect unauthorized users to appropriate fallback route
- **Observable return**: Return observable boolean for async permission checks

Reference permission patterns:
- `projects/frontend/app/src/features/keycloak-auth/components/require-permission.tsx` - React permission checking patterns
- Angular guard should mirror the permission checking logic but at route level

### Interfaces
```typescript
// Guard interfaces
interface UserManagementGuard {
  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean;
}

// Permission service interface (to be consumed)
interface PermissionService {
  hasPermission(permission: Permission): Observable<boolean>;
  hasAllPermissions(permissions: Permission[]): Observable<boolean>;
  hasAnyPermission(permissions: Permission[]): Observable<boolean>;
}

// Guard configuration
interface GuardConfig {
  requiredPermissions: Permission[];
  fallbackRoute: string;
  requireAll: boolean; // All permissions vs any permission
}
```

### Boundaries
- **Exposes**: Route guard for protecting user management routes
- **Consumes**: Permission service for access verification, router for navigation control
- **Constraints**:
  - Must check for `users:read` permission before allowing route activation
  - Must redirect to unauthorized/login page when access is denied
  - Must handle loading states during permission verification
  - Must support both synchronous and asynchronous permission checks

### References
- `projects/frontend/app/src/features/keycloak-auth/components/require-permission.tsx` - Permission checking patterns
- Angular Router Guards documentation for CanActivate implementation
- Authentication service integration for permission verification

## Specification

### Requirements
- Create Angular route guard for user management permission checking
- Implement permission verification requiring `users:read` access
- Handle unauthorized access with appropriate redirect behavior
- Support loading states during async permission verification
- Integrate with existing authentication/permission service
- Provide clear error messaging for debugging and user feedback

### Files
- `src/features/user-management/guards/user-management.guard.ts` - Route guard implementation
- `src/features/user-management/guards/user-management.guard.spec.ts` - Guard unit tests

### Acceptance Criteria
- [ ] Guard implements CanActivate interface correctly
- [ ] Guard checks for `users:read` permission before route activation
- [ ] Guard allows navigation when user has required permission
- [ ] Guard prevents navigation when user lacks required permission
- [ ] Guard redirects unauthorized users to appropriate fallback route
- [ ] Guard handles loading states during async permission checks
- [ ] Guard integrates with existing permission/authentication service
- [ ] Guard can be easily configured with different permission requirements
- [ ] Guard provides proper error handling for permission check failures
- [ ] Guard is properly injectable and testable
- [ ] Guard supports both single permission and multiple permission scenarios
- [ ] Guard works correctly with Angular routing and navigation lifecycle