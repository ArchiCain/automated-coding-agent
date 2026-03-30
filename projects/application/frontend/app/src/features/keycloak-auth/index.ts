// Components
export { default as Login } from "./components/login";
export { default as LoginForm } from "./components/login-form";
export { default as ProtectedRoute } from "./components/protected-route";
export { default as RequirePermission } from "./components/require-permission";

// Hooks
export { AuthProvider, useAuth } from "./hooks/use-auth";
export { usePermission } from "./hooks/use-permission";
export type { UsePermissionReturn } from "./hooks/use-permission";

// Types
export * from "./types";
export type {
  Permission,
  Role,
  RolePermissionsMap,
  RequirePermissionOptions,
} from "./permissions/permissions.types";

// Permissions config
export {
  PERMISSIONS,
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLES,
  getPermissionsForRole,
  getPermissionsForRoles,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
} from "./permissions/permissions.config";

// Services
export { authApi } from "./services/auth.api";
export { default as api } from "@/features/api-client";
