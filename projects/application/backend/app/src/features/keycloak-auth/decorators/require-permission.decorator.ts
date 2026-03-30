// require-permission.decorator.ts
import { SetMetadata } from "@nestjs/common";
import {
  Permission,
  PermissionMetadata,
  RequirePermissionOptions,
} from "../permissions/permissions.types";

/**
 * Metadata key for required permissions
 */
export const REQUIRE_PERMISSION_KEY = "requirePermission";

/**
 * Decorator to mark routes as requiring specific permissions.
 * Can accept a single permission or an array of permissions.
 *
 * @param permissions - Single permission or array of permissions required
 * @param options - Optional configuration for permission checking
 * @returns MethodDecorator that sets permission metadata
 *
 * @example
 * // Require a single permission
 * @RequirePermission('users:read')
 *
 * @example
 * // Require any one of multiple permissions (OR logic)
 * @RequirePermission(['users:read', 'users:update'])
 *
 * @example
 * // Require all permissions (AND logic)
 * @RequirePermission(['users:read', 'users:update'], { requireAll: true })
 */
export const RequirePermission = (
  permissions: Permission | Permission[],
  options: RequirePermissionOptions = {}
) => {
  const permissionArray = Array.isArray(permissions)
    ? permissions
    : [permissions];

  const metadata: PermissionMetadata = {
    permissions: permissionArray,
    options: {
      requireAll: options.requireAll ?? false,
    },
  };

  return SetMetadata(REQUIRE_PERMISSION_KEY, metadata);
};
