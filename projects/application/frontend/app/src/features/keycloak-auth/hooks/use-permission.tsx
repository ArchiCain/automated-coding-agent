import { useMemo, useCallback } from "react";
import { useAuth } from "./use-auth";
import type { Permission } from "../permissions/permissions.types";
import {
  getPermissionsForRoles,
  hasPermission as checkHasPermission,
  hasAllPermissions as checkHasAllPermissions,
  hasAnyPermission as checkHasAnyPermission,
} from "../permissions/permissions.config";

/**
 * Return type for the usePermission hook
 */
export interface UsePermissionReturn {
  /** Array of all permissions the current user has based on their roles */
  permissions: Permission[];
  /** Check if the user has a specific permission */
  hasPermission: (permission: Permission) => boolean;
  /** Check if the user has all of the specified permissions */
  hasAllPermissions: (permissions: Permission[]) => boolean;
  /** Check if the user has any of the specified permissions */
  hasAnyPermission: (permissions: Permission[]) => boolean;
}

/**
 * Custom hook for checking user permissions derived from roles
 *
 * This hook provides a convenient way to check permissions in React components.
 * It derives the user's permissions from their roles and provides methods to
 * check for specific permissions.
 *
 * @example
 * ```tsx
 * const { hasPermission, hasAllPermissions, hasAnyPermission } = usePermission();
 *
 * // Check a single permission
 * if (hasPermission('users:read')) {
 *   // Show user list
 * }
 *
 * // Check if user has all required permissions
 * if (hasAllPermissions(['users:create', 'users:update'])) {
 *   // Show user management form
 * }
 *
 * // Check if user has any of the permissions
 * if (hasAnyPermission(['users:read', 'users:create'])) {
 *   // Show users section
 * }
 * ```
 */
export function usePermission(): UsePermissionReturn {
  const { user } = useAuth();

  // Derive permissions from user roles
  // Memoized to prevent unnecessary recalculations
  const permissions = useMemo<Permission[]>(() => {
    if (!user || !user.roles) {
      return [];
    }
    return getPermissionsForRoles(user.roles);
  }, [user]);

  // Check if the user has a specific permission
  const hasPermission = useCallback(
    (permission: Permission): boolean => {
      return checkHasPermission(permissions, permission);
    },
    [permissions]
  );

  // Check if the user has all of the specified permissions
  const hasAllPermissions = useCallback(
    (requiredPermissions: Permission[]): boolean => {
      return checkHasAllPermissions(permissions, requiredPermissions);
    },
    [permissions]
  );

  // Check if the user has any of the specified permissions
  const hasAnyPermission = useCallback(
    (requiredPermissions: Permission[]): boolean => {
      return checkHasAnyPermission(permissions, requiredPermissions);
    },
    [permissions]
  );

  return {
    permissions,
    hasPermission,
    hasAllPermissions,
    hasAnyPermission,
  };
}
