import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import RequirePermission from './require-permission';
import * as usePermissionModule from '../hooks/use-permission';
import { PERMISSIONS, ALL_PERMISSIONS } from '../permissions/permissions.config';
import type { Permission } from '../permissions/permissions.types';

// Mock the usePermission hook
vi.mock('../hooks/use-permission', () => ({
  usePermission: vi.fn(),
}));

describe('RequirePermission (Unit)', () => {
  // Helper to create a mock implementation with specific permissions
  const mockPermissions = (permissions: Permission[]) => {
    vi.mocked(usePermissionModule.usePermission).mockReturnValue({
      permissions,
      hasPermission: (permission: Permission) => permissions.includes(permission),
      hasAllPermissions: (requiredPermissions: Permission[]) =>
        requiredPermissions.every((p) => permissions.includes(p)),
      hasAnyPermission: (requiredPermissions: Permission[]) =>
        requiredPermissions.some((p) => permissions.includes(p)),
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('single permission prop', () => {
    it('should render children when user has the required permission', () => {
      mockPermissions([PERMISSIONS.USERS_READ, PERMISSIONS.USERS_CREATE]);

      render(
        <RequirePermission permission={PERMISSIONS.USERS_READ}>
          <div data-testid="protected-content">Protected Content</div>
        </RequirePermission>
      );

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('should not render children when user lacks the required permission', () => {
      mockPermissions([PERMISSIONS.CONVERSATIONS_READ, PERMISSIONS.CONVERSATIONS_CREATE]);

      render(
        <RequirePermission permission={PERMISSIONS.USERS_READ}>
          <div data-testid="protected-content">Protected Content</div>
        </RequirePermission>
      );

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('should render fallback when user lacks the required permission', () => {
      mockPermissions([PERMISSIONS.CONVERSATIONS_READ]);

      render(
        <RequirePermission
          permission={PERMISSIONS.USERS_READ}
          fallback={<div data-testid="fallback">Access Denied</div>}
        >
          <div data-testid="protected-content">Protected Content</div>
        </RequirePermission>
      );

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      expect(screen.getByTestId('fallback')).toBeInTheDocument();
      expect(screen.getByText('Access Denied')).toBeInTheDocument();
    });

    it('should render null fallback by default when user lacks permission', () => {
      mockPermissions([PERMISSIONS.CONVERSATIONS_READ]);

      const { container } = render(
        <RequirePermission permission={PERMISSIONS.USERS_READ}>
          <div data-testid="protected-content">Protected Content</div>
        </RequirePermission>
      );

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      // Container should be empty (except for React's internal wrapper)
      expect(container.firstChild).toBeNull();
    });
  });

  describe('permissions array prop', () => {
    describe('default behavior (requireAll = false)', () => {
      it('should render children when user has any of the required permissions', () => {
        mockPermissions([PERMISSIONS.USERS_READ]);

        render(
          <RequirePermission
            permissions={[PERMISSIONS.USERS_READ, PERMISSIONS.USERS_CREATE]}
          >
            <div data-testid="protected-content">Protected Content</div>
          </RequirePermission>
        );

        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      });

      it('should render children when user has all of the required permissions', () => {
        mockPermissions([
          PERMISSIONS.USERS_READ,
          PERMISSIONS.USERS_CREATE,
          PERMISSIONS.USERS_UPDATE,
        ]);

        render(
          <RequirePermission
            permissions={[PERMISSIONS.USERS_READ, PERMISSIONS.USERS_CREATE]}
          >
            <div data-testid="protected-content">Protected Content</div>
          </RequirePermission>
        );

        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      });

      it('should not render children when user has none of the required permissions', () => {
        mockPermissions([PERMISSIONS.CONVERSATIONS_READ, PERMISSIONS.CONVERSATIONS_CREATE]);

        render(
          <RequirePermission
            permissions={[PERMISSIONS.USERS_READ, PERMISSIONS.USERS_CREATE]}
          >
            <div data-testid="protected-content">Protected Content</div>
          </RequirePermission>
        );

        expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      });

      it('should render fallback when user has none of the required permissions', () => {
        mockPermissions([PERMISSIONS.CONVERSATIONS_READ]);

        render(
          <RequirePermission
            permissions={[PERMISSIONS.USERS_READ, PERMISSIONS.USERS_CREATE]}
            fallback={<div data-testid="fallback">No Access</div>}
          >
            <div data-testid="protected-content">Protected Content</div>
          </RequirePermission>
        );

        expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
        expect(screen.getByTestId('fallback')).toBeInTheDocument();
      });
    });

    describe('requireAll = true', () => {
      it('should render children when user has all required permissions', () => {
        mockPermissions([PERMISSIONS.USERS_READ, PERMISSIONS.USERS_CREATE, PERMISSIONS.USERS_UPDATE]);

        render(
          <RequirePermission
            permissions={[PERMISSIONS.USERS_READ, PERMISSIONS.USERS_CREATE]}
            requireAll={true}
          >
            <div data-testid="protected-content">Protected Content</div>
          </RequirePermission>
        );

        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      });

      it('should not render children when user is missing one required permission', () => {
        mockPermissions([PERMISSIONS.USERS_READ]);

        render(
          <RequirePermission
            permissions={[PERMISSIONS.USERS_READ, PERMISSIONS.USERS_CREATE]}
            requireAll={true}
          >
            <div data-testid="protected-content">Protected Content</div>
          </RequirePermission>
        );

        expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      });

      it('should render fallback when user is missing any required permission', () => {
        mockPermissions([PERMISSIONS.USERS_READ, PERMISSIONS.USERS_UPDATE]);

        render(
          <RequirePermission
            permissions={[PERMISSIONS.USERS_READ, PERMISSIONS.USERS_CREATE]}
            requireAll={true}
            fallback={<div data-testid="fallback">Missing Permissions</div>}
          >
            <div data-testid="protected-content">Protected Content</div>
          </RequirePermission>
        );

        expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
        expect(screen.getByTestId('fallback')).toBeInTheDocument();
      });

      it('should not render children when user has no permissions', () => {
        mockPermissions([]);

        render(
          <RequirePermission
            permissions={[PERMISSIONS.USERS_READ]}
            requireAll={true}
          >
            <div data-testid="protected-content">Protected Content</div>
          </RequirePermission>
        );

        expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      });
    });

    describe('requireAll = false (explicit)', () => {
      it('should render children when user has any of the required permissions', () => {
        mockPermissions([PERMISSIONS.USERS_CREATE]);

        render(
          <RequirePermission
            permissions={[PERMISSIONS.USERS_READ, PERMISSIONS.USERS_CREATE]}
            requireAll={false}
          >
            <div data-testid="protected-content">Protected Content</div>
          </RequirePermission>
        );

        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      });
    });
  });

  describe('empty/undefined permissions', () => {
    it('should render children when no permission is specified', () => {
      mockPermissions([PERMISSIONS.CONVERSATIONS_READ]);

      render(
        <RequirePermission>
          <div data-testid="protected-content">Protected Content</div>
        </RequirePermission>
      );

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it('should render children when permissions array is empty', () => {
      mockPermissions([PERMISSIONS.CONVERSATIONS_READ]);

      render(
        <RequirePermission permissions={[]}>
          <div data-testid="protected-content">Protected Content</div>
        </RequirePermission>
      );

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it('should render children when permissions array is empty with requireAll', () => {
      mockPermissions([]);

      render(
        <RequirePermission permissions={[]} requireAll={true}>
          <div data-testid="protected-content">Protected Content</div>
        </RequirePermission>
      );

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });
  });

  describe('fallback rendering', () => {
    it('should render complex fallback components', () => {
      mockPermissions([]);

      render(
        <RequirePermission
          permission={PERMISSIONS.USERS_READ}
          fallback={
            <div data-testid="complex-fallback">
              <h1>Access Denied</h1>
              <p>You need admin permissions</p>
              <button>Request Access</button>
            </div>
          }
        >
          <div data-testid="protected-content">Protected Content</div>
        </RequirePermission>
      );

      expect(screen.getByTestId('complex-fallback')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Access Denied' })).toBeInTheDocument();
      expect(screen.getByText('You need admin permissions')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Request Access' })).toBeInTheDocument();
    });

    it('should render string fallback', () => {
      mockPermissions([]);

      render(
        <RequirePermission
          permission={PERMISSIONS.USERS_READ}
          fallback="Access Denied"
        >
          <div data-testid="protected-content">Protected Content</div>
        </RequirePermission>
      );

      expect(screen.getByText('Access Denied')).toBeInTheDocument();
    });

    it('should render null when fallback is explicitly null', () => {
      mockPermissions([]);

      const { container } = render(
        <RequirePermission
          permission={PERMISSIONS.USERS_READ}
          fallback={null}
        >
          <div data-testid="protected-content">Protected Content</div>
        </RequirePermission>
      );

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      expect(container.firstChild).toBeNull();
    });
  });

  describe('children rendering', () => {
    it('should render multiple children', () => {
      mockPermissions([PERMISSIONS.USERS_READ]);

      render(
        <RequirePermission permission={PERMISSIONS.USERS_READ}>
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
          <div data-testid="child-3">Child 3</div>
        </RequirePermission>
      );

      expect(screen.getByTestId('child-1')).toBeInTheDocument();
      expect(screen.getByTestId('child-2')).toBeInTheDocument();
      expect(screen.getByTestId('child-3')).toBeInTheDocument();
    });

    it('should render nested components', () => {
      mockPermissions([PERMISSIONS.USERS_READ]);

      const NestedComponent = () => (
        <div data-testid="nested">
          <span>Nested content</span>
        </div>
      );

      render(
        <RequirePermission permission={PERMISSIONS.USERS_READ}>
          <NestedComponent />
        </RequirePermission>
      );

      expect(screen.getByTestId('nested')).toBeInTheDocument();
      expect(screen.getByText('Nested content')).toBeInTheDocument();
    });

    it('should render text children', () => {
      mockPermissions([PERMISSIONS.USERS_READ]);

      render(
        <RequirePermission permission={PERMISSIONS.USERS_READ}>
          Plain text content
        </RequirePermission>
      );

      expect(screen.getByText('Plain text content')).toBeInTheDocument();
    });
  });

  describe('admin user scenarios', () => {
    it('should render content for admin with all permissions', () => {
      mockPermissions(ALL_PERMISSIONS);

      render(
        <RequirePermission permission={PERMISSIONS.USERS_DELETE}>
          <div data-testid="admin-only">Admin Only Feature</div>
        </RequirePermission>
      );

      expect(screen.getByTestId('admin-only')).toBeInTheDocument();
    });

    it('should render content for admin with multiple required permissions', () => {
      mockPermissions(ALL_PERMISSIONS);

      render(
        <RequirePermission
          permissions={[
            PERMISSIONS.USERS_READ,
            PERMISSIONS.USERS_CREATE,
            PERMISSIONS.USERS_UPDATE,
            PERMISSIONS.USERS_DELETE,
          ]}
          requireAll={true}
        >
          <div data-testid="full-admin">Full Admin Access</div>
        </RequirePermission>
      );

      expect(screen.getByTestId('full-admin')).toBeInTheDocument();
    });
  });

  describe('regular user scenarios', () => {
    it('should hide user management UI from regular users', () => {
      mockPermissions([PERMISSIONS.CONVERSATIONS_READ, PERMISSIONS.CONVERSATIONS_CREATE]);

      render(
        <RequirePermission permission={PERMISSIONS.USERS_READ}>
          <div data-testid="user-management">User Management</div>
        </RequirePermission>
      );

      expect(screen.queryByTestId('user-management')).not.toBeInTheDocument();
    });

    it('should show conversation UI to regular users', () => {
      mockPermissions([PERMISSIONS.CONVERSATIONS_READ, PERMISSIONS.CONVERSATIONS_CREATE]);

      render(
        <RequirePermission permission={PERMISSIONS.CONVERSATIONS_READ}>
          <div data-testid="conversations">Conversations</div>
        </RequirePermission>
      );

      expect(screen.getByTestId('conversations')).toBeInTheDocument();
    });

    it('should show fallback for delete permission to regular users', () => {
      mockPermissions([PERMISSIONS.CONVERSATIONS_READ, PERMISSIONS.CONVERSATIONS_CREATE]);

      render(
        <RequirePermission
          permission={PERMISSIONS.CONVERSATIONS_DELETE}
          fallback={<div data-testid="no-delete">Delete not available</div>}
        >
          <button data-testid="delete-button">Delete</button>
        </RequirePermission>
      );

      expect(screen.queryByTestId('delete-button')).not.toBeInTheDocument();
      expect(screen.getByTestId('no-delete')).toBeInTheDocument();
    });
  });

  describe('unauthenticated user scenarios', () => {
    it('should not render content when user has no permissions', () => {
      mockPermissions([]);

      render(
        <RequirePermission permission={PERMISSIONS.USERS_READ}>
          <div data-testid="protected-content">Protected Content</div>
        </RequirePermission>
      );

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('should render fallback when user has no permissions', () => {
      mockPermissions([]);

      render(
        <RequirePermission
          permission={PERMISSIONS.USERS_READ}
          fallback={<div data-testid="login-prompt">Please log in</div>}
        >
          <div data-testid="protected-content">Protected Content</div>
        </RequirePermission>
      );

      expect(screen.getByTestId('login-prompt')).toBeInTheDocument();
    });
  });

  describe('priority of permission vs permissions prop', () => {
    it('should use single permission prop when provided', () => {
      mockPermissions([PERMISSIONS.USERS_READ]);

      render(
        <RequirePermission permission={PERMISSIONS.USERS_READ}>
          <div data-testid="protected-content">Protected Content</div>
        </RequirePermission>
      );

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it('should use permissions array when single permission is not provided', () => {
      mockPermissions([PERMISSIONS.USERS_CREATE]);

      render(
        <RequirePermission permissions={[PERMISSIONS.USERS_READ, PERMISSIONS.USERS_CREATE]}>
          <div data-testid="protected-content">Protected Content</div>
        </RequirePermission>
      );

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it('should prioritize single permission prop over permissions array', () => {
      // User has USERS_CREATE but not USERS_READ
      mockPermissions([PERMISSIONS.USERS_CREATE]);

      render(
        <RequirePermission
          permission={PERMISSIONS.USERS_READ}
          permissions={[PERMISSIONS.USERS_CREATE]}
        >
          <div data-testid="protected-content">Protected Content</div>
        </RequirePermission>
      );

      // Single permission takes precedence, user doesn't have USERS_READ
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });
  });

  describe('integration with usePermission hook', () => {
    it('should call usePermission hook', () => {
      mockPermissions([PERMISSIONS.USERS_READ]);

      render(
        <RequirePermission permission={PERMISSIONS.USERS_READ}>
          <div>Content</div>
        </RequirePermission>
      );

      expect(usePermissionModule.usePermission).toHaveBeenCalled();
    });

    it('should use hasPermission from the hook for single permission', () => {
      const hasPermissionMock = vi.fn().mockReturnValue(true);

      vi.mocked(usePermissionModule.usePermission).mockReturnValue({
        permissions: [PERMISSIONS.USERS_READ],
        hasPermission: hasPermissionMock,
        hasAllPermissions: vi.fn(),
        hasAnyPermission: vi.fn(),
      });

      render(
        <RequirePermission permission={PERMISSIONS.USERS_READ}>
          <div data-testid="content">Content</div>
        </RequirePermission>
      );

      expect(hasPermissionMock).toHaveBeenCalledWith(PERMISSIONS.USERS_READ);
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('should use hasAllPermissions from the hook when requireAll is true', () => {
      const hasAllPermissionsMock = vi.fn().mockReturnValue(true);

      vi.mocked(usePermissionModule.usePermission).mockReturnValue({
        permissions: [PERMISSIONS.USERS_READ, PERMISSIONS.USERS_CREATE],
        hasPermission: vi.fn(),
        hasAllPermissions: hasAllPermissionsMock,
        hasAnyPermission: vi.fn(),
      });

      render(
        <RequirePermission
          permissions={[PERMISSIONS.USERS_READ, PERMISSIONS.USERS_CREATE]}
          requireAll={true}
        >
          <div data-testid="content">Content</div>
        </RequirePermission>
      );

      expect(hasAllPermissionsMock).toHaveBeenCalledWith([
        PERMISSIONS.USERS_READ,
        PERMISSIONS.USERS_CREATE,
      ]);
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('should use hasAnyPermission from the hook when requireAll is false', () => {
      const hasAnyPermissionMock = vi.fn().mockReturnValue(true);

      vi.mocked(usePermissionModule.usePermission).mockReturnValue({
        permissions: [PERMISSIONS.USERS_READ],
        hasPermission: vi.fn(),
        hasAllPermissions: vi.fn(),
        hasAnyPermission: hasAnyPermissionMock,
      });

      render(
        <RequirePermission
          permissions={[PERMISSIONS.USERS_READ, PERMISSIONS.USERS_CREATE]}
          requireAll={false}
        >
          <div data-testid="content">Content</div>
        </RequirePermission>
      );

      expect(hasAnyPermissionMock).toHaveBeenCalledWith([
        PERMISSIONS.USERS_READ,
        PERMISSIONS.USERS_CREATE,
      ]);
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle undefined permission gracefully', () => {
      mockPermissions([PERMISSIONS.USERS_READ]);

      render(
        <RequirePermission permission={undefined}>
          <div data-testid="content">Content</div>
        </RequirePermission>
      );

      // No permission specified, should allow access
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('should handle undefined permissions array gracefully', () => {
      mockPermissions([PERMISSIONS.USERS_READ]);

      render(
        <RequirePermission permissions={undefined}>
          <div data-testid="content">Content</div>
        </RequirePermission>
      );

      // No permissions specified, should allow access
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('should handle both permission and permissions being undefined', () => {
      mockPermissions([]);

      render(
        <RequirePermission>
          <div data-testid="content">Content</div>
        </RequirePermission>
      );

      // No restrictions, should allow access even with no permissions
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });
  });

  describe('real-world use cases', () => {
    it('should show User Management nav link to admin only', () => {
      mockPermissions(ALL_PERMISSIONS);

      render(
        <nav>
          <RequirePermission permission={PERMISSIONS.USERS_READ}>
            <a href="/admin/users" data-testid="user-management-link">
              User Management
            </a>
          </RequirePermission>
        </nav>
      );

      expect(screen.getByTestId('user-management-link')).toBeInTheDocument();
    });

    it('should hide User Management nav link from regular user', () => {
      mockPermissions([PERMISSIONS.CONVERSATIONS_READ, PERMISSIONS.CONVERSATIONS_CREATE]);

      render(
        <nav>
          <RequirePermission permission={PERMISSIONS.USERS_READ}>
            <a href="/admin/users" data-testid="user-management-link">
              User Management
            </a>
          </RequirePermission>
        </nav>
      );

      expect(screen.queryByTestId('user-management-link')).not.toBeInTheDocument();
    });

    it('should show delete button only to users with delete permission', () => {
      mockPermissions([PERMISSIONS.USERS_READ, PERMISSIONS.USERS_UPDATE]);

      render(
        <div>
          <RequirePermission permission={PERMISSIONS.USERS_DELETE}>
            <button data-testid="delete-user">Delete User</button>
          </RequirePermission>
        </div>
      );

      expect(screen.queryByTestId('delete-user')).not.toBeInTheDocument();
    });

    it('should show edit form only when user can both read and update', () => {
      mockPermissions([PERMISSIONS.USERS_READ, PERMISSIONS.USERS_UPDATE]);

      render(
        <RequirePermission
          permissions={[PERMISSIONS.USERS_READ, PERMISSIONS.USERS_UPDATE]}
          requireAll={true}
        >
          <form data-testid="edit-user-form">
            <input name="email" />
            <button type="submit">Save</button>
          </form>
        </RequirePermission>
      );

      expect(screen.getByTestId('edit-user-form')).toBeInTheDocument();
    });
  });
});
