import { Permission, Role } from './permissions.types';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    'users:read', 'users:write', 'users:delete',
    'conversations:read', 'conversations:write', 'conversations:delete',
    'admin:access',
  ],
  user: [
    'conversations:read', 'conversations:write', 'conversations:delete',
  ],
  viewer: [
    'conversations:read',
  ],
};

export function getPermissionsForRoles(roles: string[]): Permission[] {
  const permissions = new Set<Permission>();
  for (const role of roles) {
    const rolePerms = ROLE_PERMISSIONS[role as Role];
    if (rolePerms) {
      rolePerms.forEach(p => permissions.add(p));
    }
  }
  return [...permissions];
}

export function hasPermission(userPermissions: Permission[], required: Permission): boolean {
  return userPermissions.includes(required);
}
