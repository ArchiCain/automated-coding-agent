import type { Permission, Role, RolePermissionsMap } from './permissions.types';

/**
 * All available permissions in the system
 * Must match backend exactly: projects/backend/app/src/packages/keycloak-auth/permissions/permissions.constants.ts
 */
export const PERMISSIONS = {
  // User management permissions
  USERS_READ: 'users:read',
  USERS_CREATE: 'users:create',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',

  // Conversation permissions
  CONVERSATIONS_READ: 'conversations:read',
  CONVERSATIONS_CREATE: 'conversations:create',
  CONVERSATIONS_DELETE: 'conversations:delete',
} as const satisfies Record<string, Permission>;

/**
 * Array of all permissions for convenience
 */
export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

/**
 * Permissions granted to each role
 * - admin: All permissions
 * - user: Conversation permissions only
 */
export const ROLE_PERMISSIONS: RolePermissionsMap = {
  admin: ALL_PERMISSIONS,
  user: [PERMISSIONS.CONVERSATIONS_READ, PERMISSIONS.CONVERSATIONS_CREATE],
};

/**
 * Available roles in the system
 */
export const ROLES: Role[] = ['admin', 'user'];

/**
 * Helper function to get permissions for a given role
 * Returns an empty array if the role is not recognized
 */
export function getPermissionsForRole(role: string): Permission[] {
  if (role in ROLE_PERMISSIONS) {
    return ROLE_PERMISSIONS[role as Role];
  }
  return [];
}

/**
 * Helper function to get permissions for an array of roles
 * Combines and deduplicates permissions from all roles
 */
export function getPermissionsForRoles(roles: string[]): Permission[] {
  const permissionSet = new Set<Permission>();

  for (const role of roles) {
    const permissions = getPermissionsForRole(role);
    for (const permission of permissions) {
      permissionSet.add(permission);
    }
  }

  return Array.from(permissionSet);
}

/**
 * Helper function to check if a set of permissions includes a required permission
 */
export function hasPermission(
  userPermissions: Permission[],
  requiredPermission: Permission
): boolean {
  return userPermissions.includes(requiredPermission);
}

/**
 * Helper function to check if a set of permissions includes all required permissions
 */
export function hasAllPermissions(
  userPermissions: Permission[],
  requiredPermissions: Permission[]
): boolean {
  return requiredPermissions.every((permission) =>
    userPermissions.includes(permission)
  );
}

/**
 * Helper function to check if a set of permissions includes any of the required permissions
 */
export function hasAnyPermission(
  userPermissions: Permission[],
  requiredPermissions: Permission[]
): boolean {
  return requiredPermissions.some((permission) =>
    userPermissions.includes(permission)
  );
}
