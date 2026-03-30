import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { UsersTable } from './UsersTable';
import type { User } from '../types';

// Mock users for testing
const mockUsers: User[] = [
  {
    id: 'user-1',
    username: 'admin',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    enabled: true,
    roles: ['admin'],
    createdTimestamp: Date.now(),
  },
  {
    id: 'user-2',
    username: 'johndoe',
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Doe',
    enabled: true,
    roles: ['user'],
    createdTimestamp: Date.now(),
  },
  {
    id: 'user-3',
    username: 'janedoe',
    email: 'jane@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    enabled: false,
    roles: ['user'],
    createdTimestamp: Date.now(),
  },
];

// Wrapper component with MemoryRouter for RouterLink
const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('UsersTable', () => {
  const mockOnSort = vi.fn();
  const mockOnToggleEnabled = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render table with all column headers', () => {
      renderWithRouter(
        <UsersTable
          users={mockUsers}
          isLoading={false}
          onSort={mockOnSort}
          onToggleEnabled={mockOnToggleEnabled}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText('Username')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('First Name')).toBeInTheDocument();
      expect(screen.getByText('Last Name')).toBeInTheDocument();
      expect(screen.getByText('Role')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    it('should render user data correctly', () => {
      renderWithRouter(
        <UsersTable
          users={mockUsers}
          isLoading={false}
          onSort={mockOnSort}
          onToggleEnabled={mockOnToggleEnabled}
          onDelete={mockOnDelete}
        />
      );

      // Check first user (admin)
      expect(screen.getByText('admin')).toBeInTheDocument();
      expect(screen.getByText('admin@example.com')).toBeInTheDocument();
      expect(screen.getByText('Admin')).toBeInTheDocument();

      // Check second user
      expect(screen.getByText('johndoe')).toBeInTheDocument();
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
      expect(screen.getByText('John')).toBeInTheDocument();
      expect(screen.getByText('Doe')).toBeInTheDocument();

      // Check third user
      expect(screen.getByText('janedoe')).toBeInTheDocument();
      expect(screen.getByText('jane@example.com')).toBeInTheDocument();
      expect(screen.getByText('Jane')).toBeInTheDocument();
    });

    it('should display role chips correctly', () => {
      renderWithRouter(
        <UsersTable
          users={mockUsers}
          isLoading={false}
          onSort={mockOnSort}
          onToggleEnabled={mockOnToggleEnabled}
          onDelete={mockOnDelete}
        />
      );

      // Admin role chip
      const adminChips = screen.getAllByText('Admin');
      expect(adminChips.length).toBeGreaterThan(0);

      // User role chips
      const userChips = screen.getAllByText('User');
      expect(userChips.length).toBe(2);
    });

    it('should display status chips correctly', () => {
      renderWithRouter(
        <UsersTable
          users={mockUsers}
          isLoading={false}
          onSort={mockOnSort}
          onToggleEnabled={mockOnToggleEnabled}
          onDelete={mockOnDelete}
        />
      );

      const enabledChips = screen.getAllByText('Enabled');
      expect(enabledChips.length).toBe(2);

      const disabledChips = screen.getAllByText('Disabled');
      expect(disabledChips.length).toBe(1);
    });

    it('should display dash for missing first/last name', () => {
      const usersWithMissingNames: User[] = [
        {
          id: 'user-4',
          username: 'noname',
          email: 'noname@example.com',
          enabled: true,
          roles: ['user'],
        },
      ];

      renderWithRouter(
        <UsersTable
          users={usersWithMissingNames}
          isLoading={false}
          onSort={mockOnSort}
          onToggleEnabled={mockOnToggleEnabled}
          onDelete={mockOnDelete}
        />
      );

      // Should show '-' for missing names
      const dashes = screen.getAllByText('-');
      expect(dashes.length).toBe(2);
    });
  });

  describe('Loading State', () => {
    it('should display loading indicator when isLoading is true', () => {
      renderWithRouter(
        <UsersTable
          users={[]}
          isLoading={true}
          onSort={mockOnSort}
          onToggleEnabled={mockOnToggleEnabled}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText('Loading users...')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should not display table when loading', () => {
      renderWithRouter(
        <UsersTable
          users={mockUsers}
          isLoading={true}
          onSort={mockOnSort}
          onToggleEnabled={mockOnToggleEnabled}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should display empty message when no users', () => {
      renderWithRouter(
        <UsersTable
          users={[]}
          isLoading={false}
          onSort={mockOnSort}
          onToggleEnabled={mockOnToggleEnabled}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText('No users found')).toBeInTheDocument();
    });

    it('should not display table when empty', () => {
      renderWithRouter(
        <UsersTable
          users={[]}
          isLoading={false}
          onSort={mockOnSort}
          onToggleEnabled={mockOnToggleEnabled}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  describe('Sorting', () => {
    it('should call onSort when clicking sortable column header', async () => {
      const user = userEvent.setup();

      renderWithRouter(
        <UsersTable
          users={mockUsers}
          isLoading={false}
          onSort={mockOnSort}
          onToggleEnabled={mockOnToggleEnabled}
          onDelete={mockOnDelete}
        />
      );

      const usernameHeader = screen.getByText('Username');
      await user.click(usernameHeader);

      expect(mockOnSort).toHaveBeenCalledWith('username');
    });

    it('should call onSort with correct field for email column', async () => {
      const user = userEvent.setup();

      renderWithRouter(
        <UsersTable
          users={mockUsers}
          isLoading={false}
          onSort={mockOnSort}
          onToggleEnabled={mockOnToggleEnabled}
          onDelete={mockOnDelete}
        />
      );

      const emailHeader = screen.getByText('Email');
      await user.click(emailHeader);

      expect(mockOnSort).toHaveBeenCalledWith('email');
    });

    it('should call onSort with correct field for firstName column', async () => {
      const user = userEvent.setup();

      renderWithRouter(
        <UsersTable
          users={mockUsers}
          isLoading={false}
          onSort={mockOnSort}
          onToggleEnabled={mockOnToggleEnabled}
          onDelete={mockOnDelete}
        />
      );

      const firstNameHeader = screen.getByText('First Name');
      await user.click(firstNameHeader);

      expect(mockOnSort).toHaveBeenCalledWith('firstName');
    });

    it('should call onSort with correct field for lastName column', async () => {
      const user = userEvent.setup();

      renderWithRouter(
        <UsersTable
          users={mockUsers}
          isLoading={false}
          onSort={mockOnSort}
          onToggleEnabled={mockOnToggleEnabled}
          onDelete={mockOnDelete}
        />
      );

      const lastNameHeader = screen.getByText('Last Name');
      await user.click(lastNameHeader);

      expect(mockOnSort).toHaveBeenCalledWith('lastName');
    });

    it('should not call onSort when clicking non-sortable column (Role)', async () => {
      const user = userEvent.setup();

      renderWithRouter(
        <UsersTable
          users={mockUsers}
          isLoading={false}
          onSort={mockOnSort}
          onToggleEnabled={mockOnToggleEnabled}
          onDelete={mockOnDelete}
        />
      );

      const roleHeader = screen.getByText('Role');
      await user.click(roleHeader);

      expect(mockOnSort).not.toHaveBeenCalled();
    });

    it('should display active sort indicator', () => {
      renderWithRouter(
        <UsersTable
          users={mockUsers}
          isLoading={false}
          sortBy="username"
          sortDirection="asc"
          onSort={mockOnSort}
          onToggleEnabled={mockOnToggleEnabled}
          onDelete={mockOnDelete}
        />
      );

      // Find the sort label for username - it should be active
      const usernameHeader = screen.getByText('Username').closest('span');
      expect(usernameHeader).toBeInTheDocument();
    });

    it('should display descending sort direction', () => {
      renderWithRouter(
        <UsersTable
          users={mockUsers}
          isLoading={false}
          sortBy="email"
          sortDirection="desc"
          onSort={mockOnSort}
          onToggleEnabled={mockOnToggleEnabled}
          onDelete={mockOnDelete}
        />
      );

      // The table should render with desc direction
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    it('should render edit link for each user', () => {
      renderWithRouter(
        <UsersTable
          users={mockUsers}
          isLoading={false}
          onSort={mockOnSort}
          onToggleEnabled={mockOnToggleEnabled}
          onDelete={mockOnDelete}
        />
      );

      const editLinks = screen.getAllByRole('link', { name: /edit/i });
      expect(editLinks.length).toBe(mockUsers.length);
    });

    it('should have correct href for edit links', () => {
      renderWithRouter(
        <UsersTable
          users={mockUsers}
          isLoading={false}
          onSort={mockOnSort}
          onToggleEnabled={mockOnToggleEnabled}
          onDelete={mockOnDelete}
        />
      );

      const editLink = screen.getByRole('link', { name: /edit admin/i });
      expect(editLink).toHaveAttribute('href', '/admin/users/user-1');
    });

    it('should call onToggleEnabled when clicking toggle button for enabled user', async () => {
      const user = userEvent.setup();

      renderWithRouter(
        <UsersTable
          users={mockUsers}
          isLoading={false}
          onSort={mockOnSort}
          onToggleEnabled={mockOnToggleEnabled}
          onDelete={mockOnDelete}
        />
      );

      const disableButton = screen.getByRole('button', { name: /disable admin/i });
      await user.click(disableButton);

      expect(mockOnToggleEnabled).toHaveBeenCalledWith(mockUsers[0]);
    });

    it('should call onToggleEnabled when clicking toggle button for disabled user', async () => {
      const user = userEvent.setup();

      renderWithRouter(
        <UsersTable
          users={mockUsers}
          isLoading={false}
          onSort={mockOnSort}
          onToggleEnabled={mockOnToggleEnabled}
          onDelete={mockOnDelete}
        />
      );

      const enableButton = screen.getByRole('button', { name: /enable janedoe/i });
      await user.click(enableButton);

      expect(mockOnToggleEnabled).toHaveBeenCalledWith(mockUsers[2]);
    });

    it('should call onDelete when clicking delete button', async () => {
      const user = userEvent.setup();

      renderWithRouter(
        <UsersTable
          users={mockUsers}
          isLoading={false}
          onSort={mockOnSort}
          onToggleEnabled={mockOnToggleEnabled}
          onDelete={mockOnDelete}
        />
      );

      const deleteButton = screen.getByRole('button', { name: /delete admin/i });
      await user.click(deleteButton);

      expect(mockOnDelete).toHaveBeenCalledWith(mockUsers[0]);
    });

    it('should render all action buttons for each user', () => {
      renderWithRouter(
        <UsersTable
          users={mockUsers}
          isLoading={false}
          onSort={mockOnSort}
          onToggleEnabled={mockOnToggleEnabled}
          onDelete={mockOnDelete}
        />
      );

      // Each user should have edit, toggle, and delete buttons
      mockUsers.forEach((user) => {
        expect(
          screen.getByRole('link', { name: new RegExp(`edit ${user.username}`, 'i') })
        ).toBeInTheDocument();
        expect(
          screen.getByRole('button', {
            name: new RegExp(`(enable|disable) ${user.username}`, 'i'),
          })
        ).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: new RegExp(`delete ${user.username}`, 'i') })
        ).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible table with aria-label', () => {
      renderWithRouter(
        <UsersTable
          users={mockUsers}
          isLoading={false}
          onSort={mockOnSort}
          onToggleEnabled={mockOnToggleEnabled}
          onDelete={mockOnDelete}
        />
      );

      const table = screen.getByRole('table', { name: /users table/i });
      expect(table).toBeInTheDocument();
    });

    it('should have accessible action buttons with aria-labels', () => {
      renderWithRouter(
        <UsersTable
          users={mockUsers}
          isLoading={false}
          onSort={mockOnSort}
          onToggleEnabled={mockOnToggleEnabled}
          onDelete={mockOnDelete}
        />
      );

      // Check that buttons have proper aria-labels
      expect(screen.getByRole('button', { name: /disable admin/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /delete johndoe/i })).toBeInTheDocument();
    });
  });

  describe('Role Display', () => {
    it('should show "Admin" for users with admin role', () => {
      const adminUser: User[] = [
        {
          id: 'admin-1',
          username: 'superadmin',
          email: 'super@example.com',
          enabled: true,
          roles: ['admin', 'user'],
        },
      ];

      renderWithRouter(
        <UsersTable
          users={adminUser}
          isLoading={false}
          onSort={mockOnSort}
          onToggleEnabled={mockOnToggleEnabled}
          onDelete={mockOnDelete}
        />
      );

      // Admin role should take priority
      const row = screen.getByText('superadmin').closest('tr');
      expect(within(row!).getByText('Admin')).toBeInTheDocument();
    });

    it('should show "User" for users with only user role', () => {
      const regularUser: User[] = [
        {
          id: 'user-1',
          username: 'regular',
          email: 'regular@example.com',
          enabled: true,
          roles: ['user'],
        },
      ];

      renderWithRouter(
        <UsersTable
          users={regularUser}
          isLoading={false}
          onSort={mockOnSort}
          onToggleEnabled={mockOnToggleEnabled}
          onDelete={mockOnDelete}
        />
      );

      const row = screen.getByText('regular').closest('tr');
      expect(within(row!).getByText('User')).toBeInTheDocument();
    });

    it('should show first role if no standard roles match', () => {
      const customRoleUser: User[] = [
        {
          id: 'custom-1',
          username: 'customuser',
          email: 'custom@example.com',
          enabled: true,
          roles: ['customrole'],
        },
      ];

      renderWithRouter(
        <UsersTable
          users={customRoleUser}
          isLoading={false}
          onSort={mockOnSort}
          onToggleEnabled={mockOnToggleEnabled}
          onDelete={mockOnDelete}
        />
      );

      const row = screen.getByText('customuser').closest('tr');
      expect(within(row!).getByText('customrole')).toBeInTheDocument();
    });
  });
});
