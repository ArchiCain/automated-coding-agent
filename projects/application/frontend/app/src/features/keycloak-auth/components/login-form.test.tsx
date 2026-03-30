import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginForm from './login-form'
import * as useAuthModule from '../hooks/use-auth'

// Mock the useAuth hook
vi.mock('../hooks/use-auth', () => ({
  useAuth: vi.fn()
}))

describe('LoginForm (Unit)', () => {
  const mockLogin = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock implementation
    vi.mocked(useAuthModule.useAuth).mockReturnValue({
      isAuthenticated: false,
      user: null,
      isLoading: false,
      error: null,
      login: mockLogin,
      logout: vi.fn(),
      checkAuth: vi.fn()
    })
  })

  describe('Rendering', () => {
    it('should render login form with all elements', () => {
      render(<LoginForm />)

      expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    })

    it('should render username input with correct attributes', () => {
      render(<LoginForm />)

      const usernameInput = screen.getByLabelText(/username/i)
      expect(usernameInput).toHaveAttribute('type', 'text')
      expect(usernameInput).toHaveAttribute('id', 'username')
      expect(usernameInput).toHaveAttribute('placeholder', 'Username')
      expect(usernameInput).toBeRequired()
    })

    it('should render password input with correct attributes', () => {
      render(<LoginForm />)

      const passwordInput = screen.getByLabelText(/password/i)
      expect(passwordInput).toHaveAttribute('type', 'password')
      expect(passwordInput).toHaveAttribute('id', 'password')
      expect(passwordInput).toBeRequired()
    })

    it('should not show error message initially', () => {
      render(<LoginForm />)

      const errorElement = screen.queryByText(/error/i)
      expect(errorElement).not.toBeInTheDocument()
    })

    it('should display error message when error prop is provided', () => {
      const errorMessage = 'Invalid credentials'
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: errorMessage,
        login: mockLogin,
        logout: vi.fn(),
        checkAuth: vi.fn()
      })

      render(<LoginForm />)

      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })
  })

  describe('User Interaction', () => {
    it('should update username input when user types', async () => {
      const user = userEvent.setup()
      render(<LoginForm />)

      const usernameInput = screen.getByLabelText(/username/i)
      await user.type(usernameInput, 'testuser')

      expect(usernameInput).toHaveValue('testuser')
    })

    it('should update password input when user types', async () => {
      const user = userEvent.setup()
      render(<LoginForm />)

      const passwordInput = screen.getByLabelText(/password/i)
      await user.type(passwordInput, 'password123')

      expect(passwordInput).toHaveValue('password123')
    })

    it('should allow clearing inputs', async () => {
      const user = userEvent.setup()
      render(<LoginForm />)

      const usernameInput = screen.getByLabelText(/username/i)
      await user.type(usernameInput, 'test')
      await user.clear(usernameInput)

      expect(usernameInput).toHaveValue('')
    })
  })

  describe('Form Submission', () => {
    it('should call login function when form is submitted with valid data', async () => {
      const user = userEvent.setup()
      render(<LoginForm />)

      const usernameInput = screen.getByLabelText(/username/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })

      await user.type(usernameInput, 'testuser')
      await user.type(passwordInput, 'testpass')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          username: 'testuser',
          password: 'testpass'
        })
      })
    })

    it('should not call login when username is empty', async () => {
      const user = userEvent.setup()
      render(<LoginForm />)

      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })

      await user.type(passwordInput, 'testpass')
      await user.click(submitButton)

      // Form validation should prevent submission
      expect(mockLogin).not.toHaveBeenCalled()
    })

    it('should not call login when password is empty', async () => {
      const user = userEvent.setup()
      render(<LoginForm />)

      const usernameInput = screen.getByLabelText(/username/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })

      await user.type(usernameInput, 'testuser')
      await user.click(submitButton)

      // Form validation should prevent submission
      expect(mockLogin).not.toHaveBeenCalled()
    })

    it('should not call login when both fields are empty', async () => {
      const user = userEvent.setup()
      render(<LoginForm />)

      const submitButton = screen.getByRole('button', { name: /sign in/i })
      await user.click(submitButton)

      expect(mockLogin).not.toHaveBeenCalled()
    })

    it('should prevent default form submission', async () => {
      const user = userEvent.setup()
      render(<LoginForm />)

      const usernameInput = screen.getByLabelText(/username/i)
      const passwordInput = screen.getByLabelText(/password/i)

      await user.type(usernameInput, 'testuser')
      await user.type(passwordInput, 'testpass')
      await user.type(passwordInput, '{Enter}')

      // Should call login, not trigger page reload
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled()
      })
    })
  })

  describe('Loading State', () => {
    it('should show loading text when submitting', async () => {
      const user = userEvent.setup()
      let resolveLogin: (value: void) => void
      const loginPromise = new Promise<void>((resolve) => {
        resolveLogin = resolve
      })
      mockLogin.mockReturnValue(loginPromise)

      render(<LoginForm />)

      const usernameInput = screen.getByLabelText(/username/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })

      await user.type(usernameInput, 'testuser')
      await user.type(passwordInput, 'testpass')
      await user.click(submitButton)

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText('Signing in...')).toBeInTheDocument()
      })

      // Resolve the promise
      resolveLogin!()

      // Should return to normal state
      await waitFor(() => {
        expect(screen.getByText('Sign In')).toBeInTheDocument()
      })
    })

    it('should disable submit button while submitting', async () => {
      const user = userEvent.setup()
      let resolveLogin: (value: void) => void
      const loginPromise = new Promise<void>((resolve) => {
        resolveLogin = resolve
      })
      mockLogin.mockReturnValue(loginPromise)

      render(<LoginForm />)

      const usernameInput = screen.getByLabelText(/username/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })

      expect(submitButton).toBeEnabled()

      await user.type(usernameInput, 'testuser')
      await user.type(passwordInput, 'testpass')
      await user.click(submitButton)

      // Should be disabled while loading
      await waitFor(() => {
        expect(submitButton).toBeDisabled()
      })

      // Resolve the promise
      resolveLogin!()

      // Should be enabled again
      await waitFor(() => {
        expect(submitButton).toBeEnabled()
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle login errors gracefully', async () => {
      const user = userEvent.setup()
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const loginError = new Error('Login failed')
      mockLogin.mockRejectedValue(loginError)

      render(<LoginForm />)

      const usernameInput = screen.getByLabelText(/username/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })

      await user.type(usernameInput, 'testuser')
      await user.type(passwordInput, 'wrongpass')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled()
        expect(consoleErrorSpy).toHaveBeenCalledWith('Login error:', loginError)
      })

      // Should re-enable button after error
      await waitFor(() => {
        expect(submitButton).toBeEnabled()
      })

      consoleErrorSpy.mockRestore()
    })

    it('should keep inputs populated after failed login', async () => {
      const user = userEvent.setup()
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockLogin.mockRejectedValue(new Error('Login failed'))

      render(<LoginForm />)

      const usernameInput = screen.getByLabelText(/username/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })

      await user.type(usernameInput, 'testuser')
      await user.type(passwordInput, 'wrongpass')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled()
      })

      // Inputs should retain their values
      expect(usernameInput).toHaveValue('testuser')
      expect(passwordInput).toHaveValue('wrongpass')

      consoleErrorSpy.mockRestore()
    })
  })

  describe('Styling and Accessibility', () => {
    it('should have proper form structure', () => {
      render(<LoginForm />)

      const form = screen.getByRole('button', { name: /sign in/i }).closest('form')
      expect(form).toBeInTheDocument()
    })

    it('should associate labels with inputs', () => {
      render(<LoginForm />)

      const usernameLabel = screen.getByText('Username')
      const passwordLabel = screen.getByText('Password')

      expect(usernameLabel).toHaveAttribute('for', 'username')
      expect(passwordLabel).toHaveAttribute('for', 'password')
    })

    it('should have button with correct type attribute', () => {
      render(<LoginForm />)

      const submitButton = screen.getByRole('button', { name: /sign in/i })
      expect(submitButton).toHaveAttribute('type', 'submit')
    })
  })
})
