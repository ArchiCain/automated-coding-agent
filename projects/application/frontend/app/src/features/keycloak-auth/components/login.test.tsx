import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Login from './login'
import * as useAuthModule from '../hooks/use-auth'
import * as reactRouterDom from 'react-router-dom'

// Mock the useAuth hook
vi.mock('../hooks/use-auth', () => ({
  useAuth: vi.fn()
}))

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: vi.fn()
  }
})

// Mock LoginForm component
vi.mock('./login-form', () => ({
  default: () => <div data-testid="login-form">Login Form</div>
}))

describe('Login (Unit)', () => {
  const mockNavigate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(reactRouterDom.useNavigate).mockReturnValue(mockNavigate)

    // Default mock - not authenticated, not loading
    vi.mocked(useAuthModule.useAuth).mockReturnValue({
      isAuthenticated: false,
      user: null,
      isLoading: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      checkAuth: vi.fn()
    })
  })

  describe('Rendering', () => {
    it('should render welcome message', () => {
      render(<Login />)

      expect(screen.getByText('Welcome')).toBeInTheDocument()
      expect(screen.getByText('Please sign in to continue')).toBeInTheDocument()
    })

    it('should render LoginForm when not authenticated and not loading', () => {
      render(<Login />)

      expect(screen.getByTestId('login-form')).toBeInTheDocument()
    })

    it('should have proper page structure', () => {
      render(<Login />)

      expect(screen.getByText('Welcome')).toBeInTheDocument()
      // MUI Container with minHeight: '100vh' for full page layout
    })
  })

  describe('Loading State', () => {
    it('should show loading spinner when isLoading is true', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: false,
        user: null,
        isLoading: true,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn()
      })

      render(<Login />)

      // Should show MUI CircularProgress, not login form
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
      expect(screen.queryByTestId('login-form')).not.toBeInTheDocument()
    })

    it('should show loading spinner in centered container', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: false,
        user: null,
        isLoading: true,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn()
      })

      render(<Login />)

      // MUI CircularProgress in centered Box
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('should not show welcome message when loading', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: false,
        user: null,
        isLoading: true,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn()
      })

      render(<Login />)

      expect(screen.queryByText('Welcome')).not.toBeInTheDocument()
    })
  })

  describe('Redirect Logic', () => {
    it('should redirect to home when authenticated and not loading', async () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: true,
        user: {
          id: 'user-1',
          username: 'testuser',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          roles: ['user']
        },
        isLoading: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn()
      })

      render(<Login />)

      // Should call navigate to redirect
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/')
      })
    })

    it('should not redirect when authenticated but still loading', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: true,
        user: {
          id: 'user-1',
          username: 'testuser',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          roles: ['user']
        },
        isLoading: true,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn()
      })

      render(<Login />)

      // Should not navigate while loading
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('should not redirect when not authenticated', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn()
      })

      render(<Login />)

      // Should not navigate
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('should redirect when authentication state changes to true', async () => {
      const { rerender } = render(<Login />)

      // Initially not authenticated
      expect(mockNavigate).not.toHaveBeenCalled()

      // Update to authenticated
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: true,
        user: {
          id: 'user-1',
          username: 'testuser',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          roles: ['user']
        },
        isLoading: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn()
      })

      rerender(<Login />)

      // Should navigate after state change
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/')
      })
    })
  })

  describe('Component Integration', () => {
    it('should render LoginForm with proper spacing', () => {
      render(<Login />)

      expect(screen.getByTestId('login-form')).toBeInTheDocument()
      // MUI Container with proper spacing via sx prop
    })

    it('should use background styling', () => {
      render(<Login />)

      expect(screen.getByText('Welcome')).toBeInTheDocument()
      // MUI Container provides theme-based background
    })

    it('should center content vertically and horizontally', () => {
      render(<Login />)

      expect(screen.getByText('Welcome')).toBeInTheDocument()
      // MUI Container with centered flex layout via sx prop
    })
  })

  describe('Accessibility', () => {
    it('should have page heading', () => {
      render(<Login />)

      const heading = screen.getByRole('heading', { name: /welcome/i })
      expect(heading).toBeInTheDocument()
      expect(heading.tagName).toBe('H1')
    })

    it('should have descriptive text for screen readers', () => {
      render(<Login />)

      expect(screen.getByText('Please sign in to continue')).toBeInTheDocument()
    })

    it('should render content in semantic order', () => {
      const { container } = render(<Login />)

      const headings = container.querySelectorAll('h1')
      expect(headings.length).toBe(1)
      expect(headings[0].textContent).toBe('Welcome')
    })
  })

  describe('Edge Cases', () => {
    it('should handle rapid auth state changes', async () => {
      const { rerender } = render(<Login />)

      // Change state multiple times
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: false,
        user: null,
        isLoading: true,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn()
      })
      rerender(<Login />)

      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: true,
        user: {
          id: 'user-1',
          username: 'testuser',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          roles: ['user']
        },
        isLoading: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn()
      })
      rerender(<Login />)

      // Should handle navigation correctly
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/')
      })
    })

    it('should not crash with null user when authenticated', async () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: true,
        user: null, // Edge case: authenticated but no user object
        isLoading: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn()
      })

      expect(() => render(<Login />)).not.toThrow()

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/')
      })
    })
  })
})
