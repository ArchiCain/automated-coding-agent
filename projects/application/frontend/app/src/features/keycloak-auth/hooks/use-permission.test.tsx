import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePermission } from './use-permission';
import * as useAuthModule from './use-auth';
import type { Permission } from '../permissions/permissions.types';
import { PERMISSIONS, ALL_PERMISSIONS } from '../permissions/permissions.config';

// Mock the useAuth hook
vi.mock('./use-auth', () => ({
  useAuth: vi.fn(),
}));

describe('usePermission (Unit)', () => {
  const mockAdminUser = {
    id: 'admin-1',
    username: 'adminuser',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    roles: ['admin'],
  };

  const mockRegularUser = {
    id: 'user-1',
    username: 'testuser',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    roles: ['user'],
  };

  const mockMultiRoleUser = {
    id: 'multi-1',
    username: 'multiuser',
    email: 'multi@example.com',
    firstName: 'Multi',
    lastName: 'User',
    roles: ['admin', 'user'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('permissions array', () => {
    it('should return all permissions for admin user', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: true,
        user: mockAdminUser,
        isLoading: false,
        error: null,
        permissions: ALL_PERMISSIONS,
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
      });

      const { result } = renderHook(() => usePermission());

      expect(result.current.permissions).toEqual(ALL_PERMISSIONS);
      expect(result.current.permissions).toContain(PERMISSIONS.USERS_READ);
      expect(result.current.permissions).toContain(PERMISSIONS.USERS_CREATE);
      expect(result.current.permissions).toContain(PERMISSIONS.USERS_UPDATE);
      expect(result.current.permissions).toContain(PERMISSIONS.USERS_DELETE);
      expect(result.current.permissions).toContain(PERMISSIONS.CONVERSATIONS_READ);
      expect(result.current.permissions).toContain(PERMISSIONS.CONVERSATIONS_CREATE);
      expect(result.current.permissions).toContain(PERMISSIONS.CONVERSATIONS_DELETE);
    });

    it('should return only conversation permissions for regular user', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: true,
        user: mockRegularUser,
        isLoading: false,
        error: null,
        permissions: [PERMISSIONS.CONVERSATIONS_READ, PERMISSIONS.CONVERSATIONS_CREATE],
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
      });

      const { result } = renderHook(() => usePermission());

      expect(result.current.permissions).toContain(PERMISSIONS.CONVERSATIONS_READ);
      expect(result.current.permissions).toContain(PERMISSIONS.CONVERSATIONS_CREATE);
      expect(result.current.permissions).not.toContain(PERMISSIONS.USERS_READ);
      expect(result.current.permissions).not.toContain(PERMISSIONS.USERS_CREATE);
      expect(result.current.permissions).not.toContain(PERMISSIONS.USERS_UPDATE);
      expect(result.current.permissions).not.toContain(PERMISSIONS.USERS_DELETE);
    });

    it('should return empty array when user is null', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null,
        permissions: [],
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
      });

      const { result } = renderHook(() => usePermission());

      expect(result.current.permissions).toEqual([]);
    });

    it('should return empty array when user has no roles', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: true,
        user: { ...mockRegularUser, roles: [] },
        isLoading: false,
        error: null,
        permissions: [],
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
      });

      const { result } = renderHook(() => usePermission());

      expect(result.current.permissions).toEqual([]);
    });

    it('should return empty array when user.roles is undefined', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: true,
        user: { ...mockRegularUser, roles: undefined as unknown as string[] },
        isLoading: false,
        error: null,
        permissions: [],
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
      });

      const { result } = renderHook(() => usePermission());

      expect(result.current.permissions).toEqual([]);
    });

    it('should combine permissions from multiple roles', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: true,
        user: mockMultiRoleUser,
        isLoading: false,
        error: null,
        permissions: ALL_PERMISSIONS,
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
      });

      const { result } = renderHook(() => usePermission());

      // Admin role provides all permissions, so user should have all
      expect(result.current.permissions).toEqual(ALL_PERMISSIONS);
    });

    it('should handle unknown roles gracefully', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: true,
        user: { ...mockRegularUser, roles: ['unknown-role'] },
        isLoading: false,
        error: null,
        permissions: [],
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
      });

      const { result } = renderHook(() => usePermission());

      // Unknown roles should map to no permissions
      expect(result.current.permissions).toEqual([]);
    });
  });

  describe('hasPermission', () => {
    it('should return true when user has the permission', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: true,
        user: mockAdminUser,
        isLoading: false,
        error: null,
        permissions: ALL_PERMISSIONS,
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
      });

      const { result } = renderHook(() => usePermission());

      expect(result.current.hasPermission(PERMISSIONS.USERS_READ)).toBe(true);
      expect(result.current.hasPermission(PERMISSIONS.USERS_CREATE)).toBe(true);
      expect(result.current.hasPermission(PERMISSIONS.USERS_UPDATE)).toBe(true);
      expect(result.current.hasPermission(PERMISSIONS.USERS_DELETE)).toBe(true);
    });

    it('should return false when user does not have the permission', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: true,
        user: mockRegularUser,
        isLoading: false,
        error: null,
        permissions: [PERMISSIONS.CONVERSATIONS_READ, PERMISSIONS.CONVERSATIONS_CREATE],
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
      });

      const { result } = renderHook(() => usePermission());

      expect(result.current.hasPermission(PERMISSIONS.USERS_READ)).toBe(false);
      expect(result.current.hasPermission(PERMISSIONS.USERS_CREATE)).toBe(false);
      expect(result.current.hasPermission(PERMISSIONS.USERS_DELETE)).toBe(false);
    });

    it('should return false when user has no permissions', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null,
        permissions: [],
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
      });

      const { result } = renderHook(() => usePermission());

      expect(result.current.hasPermission(PERMISSIONS.USERS_READ)).toBe(false);
      expect(result.current.hasPermission(PERMISSIONS.CONVERSATIONS_READ)).toBe(false);
    });

    it('should be a stable function reference', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: true,
        user: mockAdminUser,
        isLoading: false,
        error: null,
        permissions: ALL_PERMISSIONS,
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
      });

      const { result, rerender } = renderHook(() => usePermission());
      const firstHasPermission = result.current.hasPermission;

      rerender();
      const secondHasPermission = result.current.hasPermission;

      expect(firstHasPermission).toBe(secondHasPermission);
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true when user has all required permissions', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: true,
        user: mockAdminUser,
        isLoading: false,
        error: null,
        permissions: ALL_PERMISSIONS,
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
      });

      const { result } = renderHook(() => usePermission());

      expect(
        result.current.hasAllPermissions([PERMISSIONS.USERS_READ, PERMISSIONS.USERS_CREATE])
      ).toBe(true);

      expect(
        result.current.hasAllPermissions([
          PERMISSIONS.USERS_READ,
          PERMISSIONS.USERS_CREATE,
          PERMISSIONS.USERS_UPDATE,
          PERMISSIONS.USERS_DELETE,
        ])
      ).toBe(true);
    });

    it('should return false when user is missing any required permission', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: true,
        user: mockRegularUser,
        isLoading: false,
        error: null,
        permissions: [PERMISSIONS.CONVERSATIONS_READ, PERMISSIONS.CONVERSATIONS_CREATE],
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
      });

      const { result } = renderHook(() => usePermission());

      expect(
        result.current.hasAllPermissions([
          PERMISSIONS.CONVERSATIONS_READ,
          PERMISSIONS.USERS_READ,
        ])
      ).toBe(false);
    });

    it('should return true for empty permissions array', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: true,
        user: mockRegularUser,
        isLoading: false,
        error: null,
        permissions: [PERMISSIONS.CONVERSATIONS_READ, PERMISSIONS.CONVERSATIONS_CREATE],
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
      });

      const { result } = renderHook(() => usePermission());

      expect(result.current.hasAllPermissions([])).toBe(true);
    });

    it('should return false when user has no permissions', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null,
        permissions: [],
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
      });

      const { result } = renderHook(() => usePermission());

      expect(result.current.hasAllPermissions([PERMISSIONS.USERS_READ])).toBe(false);
    });

    it('should be a stable function reference', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: true,
        user: mockAdminUser,
        isLoading: false,
        error: null,
        permissions: ALL_PERMISSIONS,
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
      });

      const { result, rerender } = renderHook(() => usePermission());
      const firstHasAllPermissions = result.current.hasAllPermissions;

      rerender();
      const secondHasAllPermissions = result.current.hasAllPermissions;

      expect(firstHasAllPermissions).toBe(secondHasAllPermissions);
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true when user has at least one of the required permissions', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: true,
        user: mockRegularUser,
        isLoading: false,
        error: null,
        permissions: [PERMISSIONS.CONVERSATIONS_READ, PERMISSIONS.CONVERSATIONS_CREATE],
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
      });

      const { result } = renderHook(() => usePermission());

      expect(
        result.current.hasAnyPermission([PERMISSIONS.CONVERSATIONS_READ, PERMISSIONS.USERS_READ])
      ).toBe(true);
    });

    it('should return false when user has none of the required permissions', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: true,
        user: mockRegularUser,
        isLoading: false,
        error: null,
        permissions: [PERMISSIONS.CONVERSATIONS_READ, PERMISSIONS.CONVERSATIONS_CREATE],
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
      });

      const { result } = renderHook(() => usePermission());

      expect(
        result.current.hasAnyPermission([PERMISSIONS.USERS_READ, PERMISSIONS.USERS_CREATE])
      ).toBe(false);
    });

    it('should return false for empty permissions array', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: true,
        user: mockRegularUser,
        isLoading: false,
        error: null,
        permissions: [PERMISSIONS.CONVERSATIONS_READ, PERMISSIONS.CONVERSATIONS_CREATE],
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
      });

      const { result } = renderHook(() => usePermission());

      expect(result.current.hasAnyPermission([])).toBe(false);
    });

    it('should return true when user has all of the required permissions', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: true,
        user: mockAdminUser,
        isLoading: false,
        error: null,
        permissions: ALL_PERMISSIONS,
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
      });

      const { result } = renderHook(() => usePermission());

      expect(
        result.current.hasAnyPermission([PERMISSIONS.USERS_READ, PERMISSIONS.USERS_CREATE])
      ).toBe(true);
    });

    it('should return false when user has no permissions', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null,
        permissions: [],
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
      });

      const { result } = renderHook(() => usePermission());

      expect(result.current.hasAnyPermission([PERMISSIONS.USERS_READ])).toBe(false);
    });

    it('should be a stable function reference', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: true,
        user: mockAdminUser,
        isLoading: false,
        error: null,
        permissions: ALL_PERMISSIONS,
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
      });

      const { result, rerender } = renderHook(() => usePermission());
      const firstHasAnyPermission = result.current.hasAnyPermission;

      rerender();
      const secondHasAnyPermission = result.current.hasAnyPermission;

      expect(firstHasAnyPermission).toBe(secondHasAnyPermission);
    });
  });

  describe('memoization', () => {
    it('should return the same permissions array reference when user does not change', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: true,
        user: mockAdminUser,
        isLoading: false,
        error: null,
        permissions: ALL_PERMISSIONS,
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
      });

      const { result, rerender } = renderHook(() => usePermission());
      const firstPermissions = result.current.permissions;

      rerender();
      const secondPermissions = result.current.permissions;

      expect(firstPermissions).toBe(secondPermissions);
    });

    it('should return a new permissions array when user changes', () => {
      const mockAuth = vi.mocked(useAuthModule.useAuth);

      mockAuth.mockReturnValue({
        isAuthenticated: true,
        user: mockRegularUser,
        isLoading: false,
        error: null,
        permissions: [PERMISSIONS.CONVERSATIONS_READ, PERMISSIONS.CONVERSATIONS_CREATE],
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
      });

      const { result, rerender } = renderHook(() => usePermission());
      const firstPermissions = result.current.permissions;

      // Change user to admin
      mockAuth.mockReturnValue({
        isAuthenticated: true,
        user: mockAdminUser,
        isLoading: false,
        error: null,
        permissions: ALL_PERMISSIONS,
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
      });

      rerender();
      const secondPermissions = result.current.permissions;

      expect(firstPermissions).not.toBe(secondPermissions);
    });
  });

  describe('hook interface', () => {
    it('should return all expected properties', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: true,
        user: mockAdminUser,
        isLoading: false,
        error: null,
        permissions: ALL_PERMISSIONS,
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
      });

      const { result } = renderHook(() => usePermission());

      expect(result.current).toHaveProperty('permissions');
      expect(result.current).toHaveProperty('hasPermission');
      expect(result.current).toHaveProperty('hasAllPermissions');
      expect(result.current).toHaveProperty('hasAnyPermission');
    });

    it('should return functions for permission checks', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: true,
        user: mockAdminUser,
        isLoading: false,
        error: null,
        permissions: ALL_PERMISSIONS,
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
      });

      const { result } = renderHook(() => usePermission());

      expect(typeof result.current.hasPermission).toBe('function');
      expect(typeof result.current.hasAllPermissions).toBe('function');
      expect(typeof result.current.hasAnyPermission).toBe('function');
    });

    it('should return an array for permissions', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: true,
        user: mockAdminUser,
        isLoading: false,
        error: null,
        permissions: ALL_PERMISSIONS,
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
      });

      const { result } = renderHook(() => usePermission());

      expect(Array.isArray(result.current.permissions)).toBe(true);
    });
  });

  describe('role-based permission scenarios', () => {
    it('should correctly determine admin can manage users', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: true,
        user: mockAdminUser,
        isLoading: false,
        error: null,
        permissions: ALL_PERMISSIONS,
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
      });

      const { result } = renderHook(() => usePermission());

      // Admin should have all user management permissions
      expect(result.current.hasPermission(PERMISSIONS.USERS_READ)).toBe(true);
      expect(result.current.hasPermission(PERMISSIONS.USERS_CREATE)).toBe(true);
      expect(result.current.hasPermission(PERMISSIONS.USERS_UPDATE)).toBe(true);
      expect(result.current.hasPermission(PERMISSIONS.USERS_DELETE)).toBe(true);
    });

    it('should correctly determine regular user cannot manage users', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: true,
        user: mockRegularUser,
        isLoading: false,
        error: null,
        permissions: [PERMISSIONS.CONVERSATIONS_READ, PERMISSIONS.CONVERSATIONS_CREATE],
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
      });

      const { result } = renderHook(() => usePermission());

      // Regular user should NOT have user management permissions
      expect(result.current.hasPermission(PERMISSIONS.USERS_READ)).toBe(false);
      expect(result.current.hasPermission(PERMISSIONS.USERS_CREATE)).toBe(false);
      expect(result.current.hasPermission(PERMISSIONS.USERS_UPDATE)).toBe(false);
      expect(result.current.hasPermission(PERMISSIONS.USERS_DELETE)).toBe(false);
    });

    it('should correctly determine regular user can use conversations', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: true,
        user: mockRegularUser,
        isLoading: false,
        error: null,
        permissions: [PERMISSIONS.CONVERSATIONS_READ, PERMISSIONS.CONVERSATIONS_CREATE],
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
      });

      const { result } = renderHook(() => usePermission());

      // Regular user should have conversation read and create permissions
      expect(result.current.hasPermission(PERMISSIONS.CONVERSATIONS_READ)).toBe(true);
      expect(result.current.hasPermission(PERMISSIONS.CONVERSATIONS_CREATE)).toBe(true);
      // But NOT delete
      expect(result.current.hasPermission(PERMISSIONS.CONVERSATIONS_DELETE)).toBe(false);
    });

    it('should correctly determine admin can manage conversations', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: true,
        user: mockAdminUser,
        isLoading: false,
        error: null,
        permissions: ALL_PERMISSIONS,
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
      });

      const { result } = renderHook(() => usePermission());

      // Admin should have all conversation permissions including delete
      expect(result.current.hasPermission(PERMISSIONS.CONVERSATIONS_READ)).toBe(true);
      expect(result.current.hasPermission(PERMISSIONS.CONVERSATIONS_CREATE)).toBe(true);
      expect(result.current.hasPermission(PERMISSIONS.CONVERSATIONS_DELETE)).toBe(true);
    });
  });
});
