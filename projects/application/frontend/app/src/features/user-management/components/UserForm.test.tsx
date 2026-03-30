import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserForm, type UserFormValues } from './UserForm';

describe('UserForm', () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSubmit.mockResolvedValue(undefined);
  });

  describe('Rendering - Create Mode', () => {
    it('should render all form fields in create mode', () => {
      render(
        <UserForm
          onSubmit={mockOnSubmit}
          isLoading={false}
          mode="create"
        />
      );

      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/role/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/temporary password/i)).toBeInTheDocument();
    });

    it('should render submit button with "Create User" text', () => {
      render(
        <UserForm
          onSubmit={mockOnSubmit}
          isLoading={false}
          mode="create"
        />
      );

      expect(screen.getByRole('button', { name: /create user/i })).toBeInTheDocument();
    });

    it('should have username field enabled in create mode', () => {
      render(
        <UserForm
          onSubmit={mockOnSubmit}
          isLoading={false}
          mode="create"
        />
      );

      const usernameInput = screen.getByLabelText(/username/i);
      expect(usernameInput).not.toBeDisabled();
    });

    it('should show password helper text about first login', () => {
      render(
        <UserForm
          onSubmit={mockOnSubmit}
          isLoading={false}
          mode="create"
        />
      );

      expect(screen.getByText(/user will be prompted to change this on first login/i)).toBeInTheDocument();
    });
  });

  describe('Rendering - Edit Mode', () => {
    const initialValues: Partial<UserFormValues> = {
      username: 'testuser',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'user',
    };

    it('should render form with initial values in edit mode', () => {
      render(
        <UserForm
          initialValues={initialValues}
          onSubmit={mockOnSubmit}
          isLoading={false}
          mode="edit"
        />
      );

      expect(screen.getByDisplayValue('testuser')).toBeInTheDocument();
      expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test')).toBeInTheDocument();
      expect(screen.getByDisplayValue('User')).toBeInTheDocument();
    });

    it('should have username field disabled in edit mode', () => {
      render(
        <UserForm
          initialValues={initialValues}
          onSubmit={mockOnSubmit}
          isLoading={false}
          mode="edit"
        />
      );

      const usernameInput = screen.getByLabelText(/username/i);
      expect(usernameInput).toBeDisabled();
    });

    it('should NOT render password field in edit mode', () => {
      render(
        <UserForm
          initialValues={initialValues}
          onSubmit={mockOnSubmit}
          isLoading={false}
          mode="edit"
        />
      );

      expect(screen.queryByLabelText(/temporary password/i)).not.toBeInTheDocument();
    });

    it('should render submit button with "Update User" text', () => {
      render(
        <UserForm
          initialValues={initialValues}
          onSubmit={mockOnSubmit}
          isLoading={false}
          mode="edit"
        />
      );

      expect(screen.getByRole('button', { name: /update user/i })).toBeInTheDocument();
    });
  });

  describe('Form Validation - Required Fields', () => {
    it('should show error when username is empty on submit', async () => {
      const user = userEvent.setup();

      render(
        <UserForm
          onSubmit={mockOnSubmit}
          isLoading={false}
          mode="create"
        />
      );

      // Fill other fields but not username
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/first name/i), 'Test');
      await user.type(screen.getByLabelText(/last name/i), 'User');
      await user.type(screen.getByLabelText(/temporary password/i), 'password123');

      await user.click(screen.getByRole('button', { name: /create user/i }));

      await waitFor(() => {
        expect(screen.getByText(/username is required/i)).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should show error when email is empty on submit', async () => {
      const user = userEvent.setup();

      render(
        <UserForm
          onSubmit={mockOnSubmit}
          isLoading={false}
          mode="create"
        />
      );

      // Fill other fields but not email
      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/first name/i), 'Test');
      await user.type(screen.getByLabelText(/last name/i), 'User');
      await user.type(screen.getByLabelText(/temporary password/i), 'password123');

      await user.click(screen.getByRole('button', { name: /create user/i }));

      await waitFor(() => {
        expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should show error when first name is empty on submit', async () => {
      const user = userEvent.setup();

      render(
        <UserForm
          onSubmit={mockOnSubmit}
          isLoading={false}
          mode="create"
        />
      );

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/last name/i), 'User');
      await user.type(screen.getByLabelText(/temporary password/i), 'password123');

      await user.click(screen.getByRole('button', { name: /create user/i }));

      await waitFor(() => {
        expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should show error when last name is empty on submit', async () => {
      const user = userEvent.setup();

      render(
        <UserForm
          onSubmit={mockOnSubmit}
          isLoading={false}
          mode="create"
        />
      );

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/first name/i), 'Test');
      await user.type(screen.getByLabelText(/temporary password/i), 'password123');

      await user.click(screen.getByRole('button', { name: /create user/i }));

      await waitFor(() => {
        expect(screen.getByText(/last name is required/i)).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should show error when password is empty in create mode', async () => {
      const user = userEvent.setup();

      render(
        <UserForm
          onSubmit={mockOnSubmit}
          isLoading={false}
          mode="create"
        />
      );

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/first name/i), 'Test');
      await user.type(screen.getByLabelText(/last name/i), 'User');

      await user.click(screen.getByRole('button', { name: /create user/i }));

      await waitFor(() => {
        expect(screen.getByText(/temporary password is required/i)).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Form Validation - Format and Length', () => {
    it('should show error for invalid email format', async () => {
      const user = userEvent.setup();

      render(
        <UserForm
          onSubmit={mockOnSubmit}
          isLoading={false}
          mode="create"
        />
      );

      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'invalid-email');
      await user.tab(); // Trigger blur

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });
    });

    it('should show error for username less than 3 characters', async () => {
      const user = userEvent.setup();

      render(
        <UserForm
          onSubmit={mockOnSubmit}
          isLoading={false}
          mode="create"
        />
      );

      const usernameInput = screen.getByLabelText(/username/i);
      await user.type(usernameInput, 'ab');
      await user.tab(); // Trigger blur

      await waitFor(() => {
        expect(screen.getByText(/username must be at least 3 characters/i)).toBeInTheDocument();
      });
    });

    it('should show error for password less than 8 characters in create mode', async () => {
      const user = userEvent.setup();

      render(
        <UserForm
          onSubmit={mockOnSubmit}
          isLoading={false}
          mode="create"
        />
      );

      const passwordInput = screen.getByLabelText(/temporary password/i);
      await user.type(passwordInput, 'short');
      await user.tab(); // Trigger blur

      await waitFor(() => {
        expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('should call onSubmit with correct values when form is valid (create mode)', async () => {
      const user = userEvent.setup();

      render(
        <UserForm
          onSubmit={mockOnSubmit}
          isLoading={false}
          mode="create"
        />
      );

      await user.type(screen.getByLabelText(/username/i), 'newuser');
      await user.type(screen.getByLabelText(/email/i), 'newuser@example.com');
      await user.type(screen.getByLabelText(/first name/i), 'New');
      await user.type(screen.getByLabelText(/last name/i), 'User');
      await user.type(screen.getByLabelText(/temporary password/i), 'securepassword123');

      // Role select - click to open and select admin
      const roleSelect = screen.getByLabelText(/role/i);
      await user.click(roleSelect);
      await user.click(screen.getByRole('option', { name: /admin/i }));

      await user.click(screen.getByRole('button', { name: /create user/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          username: 'newuser',
          email: 'newuser@example.com',
          firstName: 'New',
          lastName: 'User',
          role: 'admin',
          temporaryPassword: 'securepassword123',
        });
      });
    });

    it('should call onSubmit with correct values when form is valid (edit mode)', async () => {
      const user = userEvent.setup();
      const initialValues: Partial<UserFormValues> = {
        username: 'existinguser',
        email: 'existing@example.com',
        firstName: 'Existing',
        lastName: 'User',
        role: 'user',
      };

      render(
        <UserForm
          initialValues={initialValues}
          onSubmit={mockOnSubmit}
          isLoading={false}
          mode="edit"
        />
      );

      // Clear and update email
      const emailInput = screen.getByLabelText(/email/i);
      await user.clear(emailInput);
      await user.type(emailInput, 'updated@example.com');

      await user.click(screen.getByRole('button', { name: /update user/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          username: 'existinguser',
          email: 'updated@example.com',
          firstName: 'Existing',
          lastName: 'User',
          role: 'user',
          temporaryPassword: '',
        });
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading text on submit button when isLoading is true', () => {
      render(
        <UserForm
          onSubmit={mockOnSubmit}
          isLoading={true}
          mode="create"
        />
      );

      expect(screen.getByRole('button', { name: /saving/i })).toBeInTheDocument();
    });

    it('should disable submit button when isLoading is true', () => {
      render(
        <UserForm
          onSubmit={mockOnSubmit}
          isLoading={true}
          mode="create"
        />
      );

      const submitButton = screen.getByRole('button', { name: /saving/i });
      expect(submitButton).toBeDisabled();
    });

    it('should disable all form fields when isLoading is true', () => {
      render(
        <UserForm
          onSubmit={mockOnSubmit}
          isLoading={true}
          mode="create"
        />
      );

      expect(screen.getByLabelText(/username/i)).toBeDisabled();
      expect(screen.getByLabelText(/email/i)).toBeDisabled();
      expect(screen.getByLabelText(/first name/i)).toBeDisabled();
      expect(screen.getByLabelText(/last name/i)).toBeDisabled();
      expect(screen.getByLabelText(/temporary password/i)).toBeDisabled();
    });

    it('should show loading spinner in submit button', () => {
      render(
        <UserForm
          onSubmit={mockOnSubmit}
          isLoading={true}
          mode="create"
        />
      );

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('User Interaction', () => {
    it('should update field value when user types', async () => {
      const user = userEvent.setup();

      render(
        <UserForm
          onSubmit={mockOnSubmit}
          isLoading={false}
          mode="create"
        />
      );

      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'test@example.com');

      expect(emailInput).toHaveValue('test@example.com');
    });

    it('should clear validation error when user starts typing', async () => {
      const user = userEvent.setup();

      render(
        <UserForm
          onSubmit={mockOnSubmit}
          isLoading={false}
          mode="create"
        />
      );

      // Trigger validation error
      const usernameInput = screen.getByLabelText(/username/i);
      await user.type(usernameInput, 'ab');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/username must be at least 3 characters/i)).toBeInTheDocument();
      });

      // Clear and type valid input
      await user.clear(usernameInput);
      await user.type(usernameInput, 'validuser');

      await waitFor(() => {
        expect(screen.queryByText(/username must be at least 3 characters/i)).not.toBeInTheDocument();
      });
    });

    it('should toggle password visibility when clicking eye icon', async () => {
      const user = userEvent.setup();

      render(
        <UserForm
          onSubmit={mockOnSubmit}
          isLoading={false}
          mode="create"
        />
      );

      const passwordInput = screen.getByLabelText(/temporary password/i);
      const toggleButton = screen.getByRole('button', { name: /toggle password visibility/i });

      // Initially password should be hidden
      expect(passwordInput).toHaveAttribute('type', 'password');

      // Click to show password
      await user.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'text');

      // Click to hide password again
      await user.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });
  });

  describe('Role Selection', () => {
    it('should default to "user" role', () => {
      render(
        <UserForm
          onSubmit={mockOnSubmit}
          isLoading={false}
          mode="create"
        />
      );

      // The role select should show "User" as default
      expect(screen.getByRole('combobox', { name: /role/i })).toHaveTextContent('User');
    });

    it('should allow selecting admin role', async () => {
      const user = userEvent.setup();

      render(
        <UserForm
          onSubmit={mockOnSubmit}
          isLoading={false}
          mode="create"
        />
      );

      const roleSelect = screen.getByLabelText(/role/i);
      await user.click(roleSelect);
      await user.click(screen.getByRole('option', { name: /admin/i }));

      expect(screen.getByRole('combobox', { name: /role/i })).toHaveTextContent('Admin');
    });
  });

  describe('Initial Values Update', () => {
    it('should update form values when initialValues prop changes', async () => {
      const { rerender } = render(
        <UserForm
          initialValues={{ username: 'original', email: '', firstName: '', lastName: '', role: 'user' }}
          onSubmit={mockOnSubmit}
          isLoading={false}
          mode="edit"
        />
      );

      expect(screen.getByDisplayValue('original')).toBeInTheDocument();

      // Update initialValues
      rerender(
        <UserForm
          initialValues={{ username: 'updated', email: 'new@example.com', firstName: '', lastName: '', role: 'user' }}
          onSubmit={mockOnSubmit}
          isLoading={false}
          mode="edit"
        />
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('updated')).toBeInTheDocument();
        expect(screen.getByDisplayValue('new@example.com')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible form with proper labels', () => {
      render(
        <UserForm
          onSubmit={mockOnSubmit}
          isLoading={false}
          mode="create"
        />
      );

      // All inputs should have associated labels
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/role/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/temporary password/i)).toBeInTheDocument();
    });

    it('should have required attributes on required fields', () => {
      render(
        <UserForm
          onSubmit={mockOnSubmit}
          isLoading={false}
          mode="create"
        />
      );

      expect(screen.getByLabelText(/username/i)).toBeRequired();
      expect(screen.getByLabelText(/email/i)).toBeRequired();
      expect(screen.getByLabelText(/first name/i)).toBeRequired();
      expect(screen.getByLabelText(/last name/i)).toBeRequired();
      expect(screen.getByLabelText(/temporary password/i)).toBeRequired();
    });

    it('should have submit button with correct type', () => {
      render(
        <UserForm
          onSubmit={mockOnSubmit}
          isLoading={false}
          mode="create"
        />
      );

      const submitButton = screen.getByRole('button', { name: /create user/i });
      expect(submitButton).toHaveAttribute('type', 'submit');
    });
  });
});
