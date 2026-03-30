/**
 * Unit tests for the permissions system
 * Tests: permission constants, role-to-permission mapping, RequirePermission decorator, and PermissionGuard
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from './permission.guard';
import { RequirePermission, REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import {
  PERMISSIONS,
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLES,
  getPermissionsForRole,
  getPermissionsForRoles,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
} from '../permissions/permissions.constants';
import { Permission, PermissionMetadata } from '../permissions/permissions.types';
import { KeycloakUserProfile } from '../keycloak-types';

describe('Permissions System (Unit)', () => {
  // ==========================================
  // Permission Constants Tests
  // ==========================================
  describe('PERMISSIONS constant', () => {
    it('should contain all expected permission keys', () => {
      expect(PERMISSIONS.USERS_READ).toBe('users:read');
      expect(PERMISSIONS.USERS_CREATE).toBe('users:create');
      expect(PERMISSIONS.USERS_UPDATE).toBe('users:update');
      expect(PERMISSIONS.USERS_DELETE).toBe('users:delete');
      expect(PERMISSIONS.CONVERSATIONS_READ).toBe('conversations:read');
      expect(PERMISSIONS.CONVERSATIONS_CREATE).toBe('conversations:create');
      expect(PERMISSIONS.CONVERSATIONS_DELETE).toBe('conversations:delete');
    });

    it('should have ALL_PERMISSIONS array containing all permission values', () => {
      expect(ALL_PERMISSIONS).toContain('users:read');
      expect(ALL_PERMISSIONS).toContain('users:create');
      expect(ALL_PERMISSIONS).toContain('users:update');
      expect(ALL_PERMISSIONS).toContain('users:delete');
      expect(ALL_PERMISSIONS).toContain('conversations:read');
      expect(ALL_PERMISSIONS).toContain('conversations:create');
      expect(ALL_PERMISSIONS).toContain('conversations:delete');
      expect(ALL_PERMISSIONS.length).toBe(7);
    });

    it('should have ROLES array with admin and user', () => {
      expect(ROLES).toContain('admin');
      expect(ROLES).toContain('user');
      expect(ROLES.length).toBe(2);
    });
  });

  // ==========================================
  // Role-to-Permission Mapping Tests
  // ==========================================
  describe('Role-to-Permission Mapping', () => {
    describe('ROLE_PERMISSIONS constant', () => {
      it('should grant admin all permissions', () => {
        expect(ROLE_PERMISSIONS.admin).toEqual(ALL_PERMISSIONS);
        expect(ROLE_PERMISSIONS.admin).toContain('users:read');
        expect(ROLE_PERMISSIONS.admin).toContain('users:create');
        expect(ROLE_PERMISSIONS.admin).toContain('users:update');
        expect(ROLE_PERMISSIONS.admin).toContain('users:delete');
        expect(ROLE_PERMISSIONS.admin).toContain('conversations:read');
        expect(ROLE_PERMISSIONS.admin).toContain('conversations:create');
        expect(ROLE_PERMISSIONS.admin).toContain('conversations:delete');
      });

      it('should grant user only conversation read and create permissions', () => {
        expect(ROLE_PERMISSIONS.user).toContain('conversations:read');
        expect(ROLE_PERMISSIONS.user).toContain('conversations:create');
        expect(ROLE_PERMISSIONS.user).not.toContain('users:read');
        expect(ROLE_PERMISSIONS.user).not.toContain('users:create');
        expect(ROLE_PERMISSIONS.user).not.toContain('users:update');
        expect(ROLE_PERMISSIONS.user).not.toContain('users:delete');
        expect(ROLE_PERMISSIONS.user).not.toContain('conversations:delete');
        expect(ROLE_PERMISSIONS.user.length).toBe(2);
      });
    });

    describe('getPermissionsForRole', () => {
      it('should return all permissions for admin role', () => {
        const permissions = getPermissionsForRole('admin');
        expect(permissions).toEqual(ALL_PERMISSIONS);
      });

      it('should return limited permissions for user role', () => {
        const permissions = getPermissionsForRole('user');
        expect(permissions).toEqual([
          PERMISSIONS.CONVERSATIONS_READ,
          PERMISSIONS.CONVERSATIONS_CREATE,
        ]);
      });

      it('should return empty array for unknown role', () => {
        const permissions = getPermissionsForRole('unknown');
        expect(permissions).toEqual([]);
      });

      it('should return empty array for empty string', () => {
        const permissions = getPermissionsForRole('');
        expect(permissions).toEqual([]);
      });
    });

    describe('getPermissionsForRoles', () => {
      it('should return all permissions for admin role', () => {
        const permissions = getPermissionsForRoles(['admin']);
        expect(permissions).toEqual(expect.arrayContaining(ALL_PERMISSIONS));
      });

      it('should return limited permissions for user role', () => {
        const permissions = getPermissionsForRoles(['user']);
        expect(permissions).toContain('conversations:read');
        expect(permissions).toContain('conversations:create');
        expect(permissions.length).toBe(2);
      });

      it('should combine permissions from multiple roles without duplicates', () => {
        const permissions = getPermissionsForRoles(['admin', 'user']);
        // Should have all permissions (admin has all)
        expect(permissions.length).toBe(ALL_PERMISSIONS.length);
        // Verify no duplicates
        const uniquePermissions = new Set(permissions);
        expect(uniquePermissions.size).toBe(permissions.length);
      });

      it('should return empty array for empty roles array', () => {
        const permissions = getPermissionsForRoles([]);
        expect(permissions).toEqual([]);
      });

      it('should ignore unknown roles', () => {
        const permissions = getPermissionsForRoles(['unknown', 'invalid']);
        expect(permissions).toEqual([]);
      });

      it('should combine known roles and ignore unknown roles', () => {
        const permissions = getPermissionsForRoles(['user', 'unknown']);
        expect(permissions).toContain('conversations:read');
        expect(permissions).toContain('conversations:create');
        expect(permissions.length).toBe(2);
      });
    });

    describe('hasPermission', () => {
      it('should return true when user has the required permission', () => {
        const userPermissions: Permission[] = ['users:read', 'users:create'];
        expect(hasPermission(userPermissions, 'users:read')).toBe(true);
      });

      it('should return false when user does not have the required permission', () => {
        const userPermissions: Permission[] = ['users:read'];
        expect(hasPermission(userPermissions, 'users:delete')).toBe(false);
      });

      it('should return false for empty permissions array', () => {
        const userPermissions: Permission[] = [];
        expect(hasPermission(userPermissions, 'users:read')).toBe(false);
      });
    });

    describe('hasAllPermissions', () => {
      it('should return true when user has all required permissions', () => {
        const userPermissions: Permission[] = ['users:read', 'users:create', 'users:update'];
        const required: Permission[] = ['users:read', 'users:create'];
        expect(hasAllPermissions(userPermissions, required)).toBe(true);
      });

      it('should return false when user is missing some permissions', () => {
        const userPermissions: Permission[] = ['users:read'];
        const required: Permission[] = ['users:read', 'users:create'];
        expect(hasAllPermissions(userPermissions, required)).toBe(false);
      });

      it('should return true for empty required permissions', () => {
        const userPermissions: Permission[] = ['users:read'];
        const required: Permission[] = [];
        expect(hasAllPermissions(userPermissions, required)).toBe(true);
      });

      it('should return true for empty user permissions when no permissions required', () => {
        const userPermissions: Permission[] = [];
        const required: Permission[] = [];
        expect(hasAllPermissions(userPermissions, required)).toBe(true);
      });

      it('should return false for empty user permissions when permissions required', () => {
        const userPermissions: Permission[] = [];
        const required: Permission[] = ['users:read'];
        expect(hasAllPermissions(userPermissions, required)).toBe(false);
      });
    });

    describe('hasAnyPermission', () => {
      it('should return true when user has any of the required permissions', () => {
        const userPermissions: Permission[] = ['users:read'];
        const required: Permission[] = ['users:read', 'users:create'];
        expect(hasAnyPermission(userPermissions, required)).toBe(true);
      });

      it('should return false when user has none of the required permissions', () => {
        const userPermissions: Permission[] = ['conversations:read'];
        const required: Permission[] = ['users:read', 'users:create'];
        expect(hasAnyPermission(userPermissions, required)).toBe(false);
      });

      it('should return false for empty required permissions', () => {
        const userPermissions: Permission[] = ['users:read'];
        const required: Permission[] = [];
        expect(hasAnyPermission(userPermissions, required)).toBe(false);
      });

      it('should return false for empty user permissions', () => {
        const userPermissions: Permission[] = [];
        const required: Permission[] = ['users:read'];
        expect(hasAnyPermission(userPermissions, required)).toBe(false);
      });
    });
  });

  // ==========================================
  // RequirePermission Decorator Tests
  // ==========================================
  describe('RequirePermission Decorator', () => {
    it('should set metadata with single permission', () => {
      // Create a test class with the decorator
      class TestController {
        @RequirePermission('users:read')
        testMethod() {
          return 'test';
        }
      }

      // Get metadata from the decorated method
      const metadata = Reflect.getMetadata(
        REQUIRE_PERMISSION_KEY,
        TestController.prototype.testMethod,
      ) as PermissionMetadata;

      expect(metadata).toBeDefined();
      expect(metadata.permissions).toEqual(['users:read']);
      expect(metadata.options.requireAll).toBe(false);
    });

    it('should set metadata with array of permissions', () => {
      class TestController {
        @RequirePermission(['users:read', 'users:update'])
        testMethod() {
          return 'test';
        }
      }

      const metadata = Reflect.getMetadata(
        REQUIRE_PERMISSION_KEY,
        TestController.prototype.testMethod,
      ) as PermissionMetadata;

      expect(metadata).toBeDefined();
      expect(metadata.permissions).toEqual(['users:read', 'users:update']);
      expect(metadata.options.requireAll).toBe(false);
    });

    it('should set requireAll option when specified', () => {
      class TestController {
        @RequirePermission(['users:read', 'users:update'], { requireAll: true })
        testMethod() {
          return 'test';
        }
      }

      const metadata = Reflect.getMetadata(
        REQUIRE_PERMISSION_KEY,
        TestController.prototype.testMethod,
      ) as PermissionMetadata;

      expect(metadata).toBeDefined();
      expect(metadata.permissions).toEqual(['users:read', 'users:update']);
      expect(metadata.options.requireAll).toBe(true);
    });

    it('should default requireAll to false when not specified', () => {
      class TestController {
        @RequirePermission(['users:read', 'users:update'], {})
        testMethod() {
          return 'test';
        }
      }

      const metadata = Reflect.getMetadata(
        REQUIRE_PERMISSION_KEY,
        TestController.prototype.testMethod,
      ) as PermissionMetadata;

      expect(metadata).toBeDefined();
      expect(metadata.options.requireAll).toBe(false);
    });
  });

  // ==========================================
  // PermissionGuard Tests
  // ==========================================
  describe('PermissionGuard', () => {
    let guard: PermissionGuard;
    let reflector: Reflector;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [PermissionGuard, Reflector],
      }).compile();

      guard = module.get<PermissionGuard>(PermissionGuard);
      reflector = module.get<Reflector>(Reflector);
    });

    /**
     * Create a mock ExecutionContext with optional user and metadata
     */
    function createMockContext(options: {
      user?: Partial<KeycloakUserProfile> | null;
      isPublic?: boolean;
      permissionMetadata?: PermissionMetadata | null;
    }): ExecutionContext {
      const mockRequest = {
        user: options.user !== null ? options.user : undefined,
      };

      const mockHandler = jest.fn();
      const mockClass = jest.fn();

      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
        getHandler: () => mockHandler,
        getClass: () => mockClass,
      } as unknown as ExecutionContext;

      // Mock reflector.getAllAndOverride
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
        if (key === 'isPublic') {
          return options.isPublic ?? false;
        }
        if (key === REQUIRE_PERMISSION_KEY) {
          return options.permissionMetadata ?? null;
        }
        return null;
      });

      return context;
    }

    describe('Public routes', () => {
      it('should allow access to public routes without user', () => {
        const context = createMockContext({
          user: null,
          isPublic: true,
        });

        expect(guard.canActivate(context)).toBe(true);
      });

      it('should allow access to public routes with user', () => {
        const context = createMockContext({
          user: { id: 'user-1', username: 'test', email: 'test@example.com', roles: ['user'] },
          isPublic: true,
        });

        expect(guard.canActivate(context)).toBe(true);
      });
    });

    describe('Routes without permission metadata', () => {
      it('should allow access when no permission metadata is set', () => {
        const context = createMockContext({
          user: { id: 'user-1', username: 'test', email: 'test@example.com', roles: ['user'] },
          permissionMetadata: null,
        });

        expect(guard.canActivate(context)).toBe(true);
      });
    });

    describe('Routes with permission requirements', () => {
      it('should throw ForbiddenException when no user is on request', () => {
        const context = createMockContext({
          user: null,
          permissionMetadata: {
            permissions: ['users:read'],
            options: { requireAll: false },
          },
        });

        expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
        expect(() => guard.canActivate(context)).toThrow('User not authenticated');
      });

      it('should allow access when user has required permission (single)', () => {
        const context = createMockContext({
          user: { id: 'admin-1', username: 'admin', email: 'admin@example.com', roles: ['admin'] },
          permissionMetadata: {
            permissions: ['users:read'],
            options: { requireAll: false },
          },
        });

        expect(guard.canActivate(context)).toBe(true);
      });

      it('should deny access when user lacks required permission', () => {
        const context = createMockContext({
          user: { id: 'user-1', username: 'user', email: 'user@example.com', roles: ['user'] },
          permissionMetadata: {
            permissions: ['users:read'],
            options: { requireAll: false },
          },
        });

        expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
        expect(() => guard.canActivate(context)).toThrow('Insufficient permissions');
      });

      it('should allow access when user has any of required permissions (requireAll=false)', () => {
        const context = createMockContext({
          user: { id: 'user-1', username: 'user', email: 'user@example.com', roles: ['user'] },
          permissionMetadata: {
            permissions: ['conversations:read', 'users:read'],
            options: { requireAll: false },
          },
        });

        expect(guard.canActivate(context)).toBe(true);
      });

      it('should deny access when user has only some permissions (requireAll=true)', () => {
        const context = createMockContext({
          user: { id: 'user-1', username: 'user', email: 'user@example.com', roles: ['user'] },
          permissionMetadata: {
            permissions: ['conversations:read', 'users:read'],
            options: { requireAll: true },
          },
        });

        expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
        expect(() => guard.canActivate(context)).toThrow('Insufficient permissions');
      });

      it('should allow access when user has all required permissions (requireAll=true)', () => {
        const context = createMockContext({
          user: { id: 'admin-1', username: 'admin', email: 'admin@example.com', roles: ['admin'] },
          permissionMetadata: {
            permissions: ['users:read', 'users:create'],
            options: { requireAll: true },
          },
        });

        expect(guard.canActivate(context)).toBe(true);
      });
    });

    describe('Edge cases', () => {
      it('should handle user with empty roles array', () => {
        const context = createMockContext({
          user: { id: 'user-1', username: 'test', email: 'test@example.com', roles: [] },
          permissionMetadata: {
            permissions: ['users:read'],
            options: { requireAll: false },
          },
        });

        expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      });

      it('should handle user with undefined roles', () => {
        const context = createMockContext({
          user: { id: 'user-1', username: 'test', email: 'test@example.com' } as KeycloakUserProfile,
          permissionMetadata: {
            permissions: ['users:read'],
            options: { requireAll: false },
          },
        });

        expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      });

      it('should handle user with unknown roles', () => {
        const context = createMockContext({
          user: { id: 'user-1', username: 'test', email: 'test@example.com', roles: ['unknown', 'invalid'] },
          permissionMetadata: {
            permissions: ['users:read'],
            options: { requireAll: false },
          },
        });

        expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      });

      it('should combine permissions from multiple roles', () => {
        const context = createMockContext({
          user: {
            id: 'user-1',
            username: 'test',
            email: 'test@example.com',
            roles: ['admin', 'user'],
          },
          permissionMetadata: {
            permissions: ['users:read', 'conversations:read'],
            options: { requireAll: true },
          },
        });

        expect(guard.canActivate(context)).toBe(true);
      });

      it('should work with requireAll defaulting to false when not specified', () => {
        const context = createMockContext({
          user: { id: 'user-1', username: 'user', email: 'user@example.com', roles: ['user'] },
          permissionMetadata: {
            permissions: ['conversations:read', 'users:read'],
            options: {},
          },
        });

        // User has conversations:read but not users:read
        // Since requireAll defaults to false, having any one should be sufficient
        expect(guard.canActivate(context)).toBe(true);
      });
    });
  });
});
