import { Permission, Role } from './permissions.types';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    'users:read', 'users:create', 'users:update', 'users:delete',
    'conversations:read', 'conversations:create', 'conversations:delete',
  ],
  user: [
    'conversations:read', 'conversations:create',
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
