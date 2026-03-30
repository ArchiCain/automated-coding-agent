import { ReactNode } from "react";
import { usePermission } from "../hooks/use-permission";
import type { Permission } from "../permissions/permissions.types";

interface RequirePermissionProps {
  /** Single permission to check */
  permission?: Permission;
  /** Array of permissions to check */
  permissions?: Permission[];
  /** When true, all permissions must be present. When false (default), any one permission is sufficient */
  requireAll?: boolean;
  /** Optional content to render when user lacks required permissions */
  fallback?: ReactNode;
  /** Content to render when user has required permissions */
  children: ReactNode;
}

/**
 * Conditionally renders children based on user permissions.
 *
 * @example
 * ```tsx
 * // Single permission check
 * <RequirePermission permission="users:read">
 *   <UserList />
 * </RequirePermission>
 *
 * // Multiple permissions - any (default)
 * <RequirePermission permissions={["users:read", "users:create"]}>
 *   <UserSection />
 * </RequirePermission>
 *
 * // Multiple permissions - all required
 * <RequirePermission permissions={["users:read", "users:update"]} requireAll>
 *   <UserEditForm />
 * </RequirePermission>
 *
 * // With custom fallback
 * <RequirePermission permission="users:delete" fallback={<NoAccess />}>
 *   <DeleteUserButton />
 * </RequirePermission>
 * ```
 */
export default function RequirePermission({
  permission,
  permissions,
  requireAll = false,
  fallback = null,
  children,
}: RequirePermissionProps) {
  const {
    hasPermission,
    hasAllPermissions,
    hasAnyPermission,
  } = usePermission();

  // Determine if user has required permissions
  const hasRequiredPermissions = (): boolean => {
    // Check single permission if provided
    if (permission) {
      return hasPermission(permission);
    }

    // Check array of permissions if provided
    if (permissions && permissions.length > 0) {
      if (requireAll) {
        return hasAllPermissions(permissions);
      }
      return hasAnyPermission(permissions);
    }

    // If no permissions specified, allow access (no restrictions)
    return true;
  };

  // Render children if user has required permissions, otherwise render fallback
  if (hasRequiredPermissions()) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
