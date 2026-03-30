/**
 * Permission string type - represents individual permissions in the format "resource:action"
 * Must match backend exactly: projects/backend/app/src/packages/keycloak-auth/permissions/permissions.types.ts
 */
export type Permission =
  | 'users:read'
  | 'users:create'
  | 'users:update'
  | 'users:delete'
  | 'conversations:read'
  | 'conversations:create'
  | 'conversations:delete';

/**
 * Role type - represents the available user roles in the system
 */
export type Role = 'admin' | 'user';

/**
 * Role-to-permissions mapping type
 */
export type RolePermissionsMap = Record<Role, Permission[]>;

/**
 * Options for permission checking
 */
export interface RequirePermissionOptions {
  /**
   * When true, all permissions in the array must be present
   * When false, any one permission is sufficient
   * @default false
   */
  requireAll?: boolean;
}
