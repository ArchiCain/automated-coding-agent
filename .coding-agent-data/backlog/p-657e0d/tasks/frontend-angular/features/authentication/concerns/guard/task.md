---
id: t-a4c5d6
parent: t-d7b9c2
created: 2026-01-26T18:12:00.000Z
updated: 2026-01-26T18:12:00.000Z
---

# Task: Authentication Guards

## Purpose
Implement Angular route guards for authentication and permission-based route protection, including loading states and redirects to login when unauthorized.

## Context

### Conventions
Follow Angular guard patterns:
- **Functional guards** using `CanActivateFn` (Angular 14+ pattern)
- **Injectable guard services** for complex logic with dependency injection
- **Router integration** for redirects and state preservation
- **Observable-based** returns for async authentication checks
- **Permission checking** using role-based access control

Reference existing patterns:
- `projects/frontend/app/src/features/keycloak-auth/components/protected-route.tsx` - React route protection logic
- Angular Router documentation for functional guards
- Permission checking from React implementation

### Interfaces
```typescript
// Functional guards
export const authGuard: CanActivateFn = (route, state) => {
  // Authentication check implementation
};

export const permissionGuard: CanActivateFn = (route, state) => {
  // Permission-based access check
};

// Injectable guard service for complex logic
@Injectable({ providedIn: 'root' })
export class AuthGuardService {
  canActivate(route: ActivatedRouteSnapshot): Observable<boolean | UrlTree>;
  checkPermissions(requiredPermissions: string[]): Observable<boolean>;
  handleUnauthorizedAccess(route: string): UrlTree;
}
```

### Boundaries
- **Exposes**: Route guards for authentication and permission checking
- **Consumes**: AuthService observables, Router for redirects, permission service
- **Constraints**:
  - Must preserve intended route for post-login redirect
  - Must support permission-based access (`users:read` for admin)
  - Must handle loading states without blocking navigation
  - Must provide clear feedback for access denied scenarios

### References
- `projects/frontend/app/src/features/keycloak-auth/components/protected-route.tsx` - Protection logic and role checking
- Angular Router functional guards documentation
- `projects/frontend/app/src/features/keycloak-auth/permissions/permissions.config.ts` - Permission mapping system

## Specification

### Requirements
- Create authentication guard to protect routes from unauthenticated users
- Implement permission guard for role-based route access control
- Handle loading states while authentication status is being determined
- Redirect unauthenticated users to login with return URL preservation
- Show access denied message for insufficient permissions
- Support both simple auth checks and complex permission requirements

### Files
- `src/app/features/authentication/guards/auth.guard.ts` - Basic authentication guard
- `src/app/features/authentication/guards/permission.guard.ts` - Permission-based guard
- `src/app/features/authentication/guards/auth-guard.service.ts` - Injectable service for complex logic
- `src/app/features/authentication/guards/index.ts` - Barrel export for guards

### Implementation Notes
- Use functional guards (`CanActivateFn`) for simple authentication checks
- Use injectable service for complex permission logic requiring DI
- Store intended route in Router state: `router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } })`
- Check authentication status from AuthService observables
- Permission checking: `requiredPermissions.every(p => userPermissions.includes(p))`

### Acceptance Criteria
- [ ] authGuard redirects unauthenticated users to login page
- [ ] permissionGuard checks role-based permissions from route data
- [ ] Guards handle loading states without premature redirects
- [ ] Return URL is preserved for post-login navigation
- [ ] Access denied feedback for insufficient permissions
- [ ] Guards work with both functional and class-based approaches
- [ ] Integration with Angular Router protection mechanisms
- [ ] Guards can be applied to individual routes and route groups