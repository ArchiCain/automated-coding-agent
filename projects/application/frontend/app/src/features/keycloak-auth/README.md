# keycloak-auth

React authentication and authorization package with Keycloak integration, session management, and role-based access control.

## Purpose

This package provides a complete authentication and authorization solution for the frontend application. It handles user login/logout, token management, session persistence, activity tracking, and role-based permission checking. The package integrates with a backend Keycloak server and manages authentication state globally through React Context.

## Usage

### Setup

Wrap your application root with the `AuthProvider`:

```typescript
import { AuthProvider } from '@packages/keycloak-auth';
import App from './App';

export default function Root() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}
```

### Authentication Hook

Access authentication state and methods in any component:

```typescript
import { useAuth } from '@packages/keycloak-auth';

export function UserProfile() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();

  if (isLoading) return <Spinner />;

  return (
    <div>
      {isAuthenticated ? (
        <>
          <p>Welcome, {user?.firstName}!</p>
          <button onClick={logout}>Logout</button>
        </>
      ) : (
        <button onClick={() => navigate('/login')}>Login</button>
      )}
    </div>
  );
}
```

### Protected Routes

Protect routes by requiring authentication and/or specific roles:

```typescript
import { ProtectedRoute } from '@packages/keycloak-auth';

<ProtectedRoute>
  <Dashboard />
</ProtectedRoute>

<ProtectedRoute requiredRoles={['admin']}>
  <AdminPanel />
</ProtectedRoute>
```

### Permission-Based Rendering

Conditionally render components based on user permissions:

```typescript
import { RequirePermission } from '@packages/keycloak-auth';

// Single permission
<RequirePermission permission="users:read">
  <UserList />
</RequirePermission>

// Multiple permissions (any)
<RequirePermission permissions={['users:read', 'users:create']}>
  <UserSection />
</RequirePermission>

// Multiple permissions (all required)
<RequirePermission
  permissions={['users:read', 'users:update']}
  requireAll
>
  <UserEditForm />
</RequirePermission>

// With fallback
<RequirePermission
  permission="users:delete"
  fallback={<AccessDenied />}
>
  <DeleteButton />
</RequirePermission>
```

### Permission Checking Hook

Use the permission hook for imperative checks:

```typescript
import { usePermission } from '@packages/keycloak-auth';

export function UserActions() {
  const { hasPermission, hasAllPermissions, hasAnyPermission } = usePermission();

  return (
    <div>
      {hasPermission('users:read') && <button>View Users</button>}
      {hasAllPermissions(['users:create', 'users:update']) && (
        <button>Manage Users</button>
      )}
      {hasAnyPermission(['users:read', 'conversations:read']) && (
        <button>View Data</button>
      )}
    </div>
  );
}
```

### Login Component

Pre-built login page component:

```typescript
import { Login } from '@packages/keycloak-auth';

<Route path="/login" element={<Login />} />
```

## API

| Export | Type | Description |
|--------|------|-------------|
| `AuthProvider` | Component | Context provider for authentication state and methods |
| `useAuth` | Hook | Access authentication state and methods (user, isAuthenticated, isLoading, error, permissions, login, logout, checkAuth) |
| `usePermission` | Hook | Check user permissions (hasPermission, hasAllPermissions, hasAnyPermission) |
| `ProtectedRoute` | Component | Route wrapper requiring authentication and optionally specific roles |
| `RequirePermission` | Component | Conditional renderer based on user permissions |
| `Login` | Component | Pre-built login page |
| `LoginForm` | Component | Login form component |
| `authApi` | Service | Backend API calls (login, logout, checkAuth, refreshToken) |
| `PERMISSIONS` | Constant | Permission constants (USERS_READ, USERS_CREATE, USERS_UPDATE, USERS_DELETE, CONVERSATIONS_READ, CONVERSATIONS_CREATE, CONVERSATIONS_DELETE) |
| `ROLE_PERMISSIONS` | Constant | Role-to-permissions mapping |
| `getPermissionsForRole` | Function | Get permissions for a single role |
| `getPermissionsForRoles` | Function | Get combined permissions for multiple roles |
| `hasPermission` | Function | Check if permissions include a specific permission |
| `hasAllPermissions` | Function | Check if permissions include all required permissions |
| `hasAnyPermission` | Function | Check if permissions include any of the required permissions |

## Permissions

The system uses resource:action permission format.

### Available Permissions

- `users:read` - Read user data
- `users:create` - Create new users
- `users:update` - Update user data
- `users:delete` - Delete users
- `conversations:read` - Read conversations
- `conversations:create` - Create conversations
- `conversations:delete` - Delete conversations

### Role-Permission Mapping

**admin**
- All permissions

**user**
- conversations:read
- conversations:create

## Key Features

### Session Management

The package automatically manages user sessions:
- Starts session management when user authenticates
- Tracks user activity (mouse, keyboard, touch, scroll)
- Stops session management on logout
- Integrates with `api-client` for token refresh timers

### State Management

Authentication state is managed through React Context with the following properties:
- `user` - Current authenticated user or null
- `isAuthenticated` - Boolean authentication status
- `isLoading` - Loading state for async operations
- `error` - Error message from failed operations
- `permissions` - Array of user permissions derived from roles

### Activity Tracking

Activity listeners are attached when authenticated and removed on logout:
- mousedown
- keydown
- touchstart
- scroll

## Configuration

Environment variables are configured through the backend API client. The package expects:
- Backend authentication endpoint at `/auth/login`
- Backend logout endpoint at `/auth/logout`
- Backend auth check endpoint at `/auth/check`
- Backend token refresh endpoint at `/auth/refresh`

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Public exports |
| `types.ts` | TypeScript type definitions (User, LoginCredentials, AuthState, AuthContextType) |
| `hooks/use-auth.tsx` | AuthProvider and useAuth hook implementation |
| `hooks/use-permission.tsx` | usePermission hook for permission checking |
| `components/login.tsx` | Login page component |
| `components/login-form.tsx` | Login form component |
| `components/protected-route.tsx` | Route protection component |
| `components/require-permission.tsx` | Permission-based conditional rendering |
| `services/auth.api.ts` | Backend API integration |
| `permissions/permissions.types.ts` | Permission and role type definitions |
| `permissions/permissions.config.ts` | Permission constants and helper functions |
| `test-utils.tsx` | Test utilities for testing components using this package |

## Dependencies

- `react` - UI library
- `react-router-dom` - Client-side routing
- `@mui/material` - Material Design components (for UI)
- `axios` - HTTP client (via api-client package)

## Notes

- Permissions must match backend exactly: `projects/backend/app/src/packages/keycloak-auth/permissions/permissions.constants.ts`
- The package automatically manages session state when authentication changes
- Activity tracking helps keep sessions alive during user interaction
- Always wrap your application with AuthProvider for the package to work correctly
- useAuth hook must be used within components that are wrapped by AuthProvider
