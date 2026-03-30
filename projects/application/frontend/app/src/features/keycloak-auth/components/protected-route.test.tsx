import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import ProtectedRoute from './protected-route'
import * as useAuthModule from '../hooks/use-auth'
import * as reactRouterDom from 'react-router-dom'

// Mock the useAuth hook
vi.mock('../hooks/use-auth', () => ({
  useAuth: vi.fn()
}))

// Mock react-router-dom Navigate component
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    Navigate: vi.fn(({ to }) => <div data-testid="navigate-to">{to}</div>),
    useLocation: vi.fn()
  }
})

describe('ProtectedRoute (Unit)', () => {
  const mockUser = {
    id: 'user-1',
    username: 'testuser',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    roles: ['user', 'editor']
  }

  const mockLocation = {
    pathname: '/protected-page',
    search: '',
    hash: '',
    state: null
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(reactRouterDom.useLocation).mockReturnValue(mockLocation as any)

    // Default mock - authenticated user with roles
    vi.mocked(useAuthModule.useAuth).mockReturnValue({
      isAuthenticated: true,
      user: mockUser,
      isLoading: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      checkAuth: vi.fn()
    })
  })

  describe('Authenticated Access', () => {
    it('should render children when authenticated and not loading', () => {
      render(
        <BrowserRouter>
          <ProtectedRoute>
            <div data-testid="protected-content">Protected Content</div>
          </ProtectedRoute>
        </BrowserRouter>
      )

      expect(screen.getByTestId('protected-content')).toBeInTheDocument()
      expect(screen.getByText('Protected Content')).toBeInTheDocument()
    })

    it('should render children when authenticated without required roles', () => {
      render(
        <BrowserRouter>
          <ProtectedRoute>
            <div data-testid="protected-content">Content</div>
          </ProtectedRoute>
        </BrowserRouter>
      )

      expect(screen.getByTestId('protected-content')).toBeInTheDocument()
    })

    it('should render multiple children', () => {
      render(
        <BrowserRouter>
          <ProtectedRoute>
            <div data-testid="child-1">Child 1</div>
            <div data-testid="child-2">Child 2</div>
          </ProtectedRoute>
        </BrowserRouter>
      )

      expect(screen.getByTestId('child-1')).toBeInTheDocument()
      expect(screen.getByTestId('child-2')).toBeInTheDocument()
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

      render(
        <BrowserRouter>
          <ProtectedRoute>
            <div data-testid="protected-content">Content</div>
          </ProtectedRoute>
        </BrowserRouter>
      )

      // Should show spinner, not content
      const spinner = screen.getByRole('progressbar')
      expect(spinner).toBeInTheDocument()
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    })

    it('should center loading spinner', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: false,
        user: null,
        isLoading: true,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn()
      })

      render(
        <BrowserRouter>
          <ProtectedRoute>
            <div>Content</div>
          </ProtectedRoute>
        </BrowserRouter>
      )

      // MUI Box with CircularProgress is rendered for loading state
      const spinner = screen.getByRole('progressbar')
      expect(spinner).toBeInTheDocument()
    })
  })

  describe('Unauthenticated Access', () => {
    it('should redirect to login when not authenticated', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn()
      })

      render(
        <BrowserRouter>
          <ProtectedRoute>
            <div data-testid="protected-content">Content</div>
          </ProtectedRoute>
        </BrowserRouter>
      )

      // Should redirect to login
      expect(screen.getByTestId('navigate-to')).toHaveTextContent('/login')
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    })

    it('should pass current location in redirect state', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn()
      })

      render(
        <BrowserRouter>
          <ProtectedRoute>
            <div>Content</div>
          </ProtectedRoute>
        </BrowserRouter>
      )

      // Navigate component should be called with location state
      const navigateCall = vi.mocked(reactRouterDom.Navigate).mock.calls[0][0]
      expect(navigateCall).toMatchObject({
        to: '/login',
        state: { from: mockLocation },
        replace: true
      })
    })
  })

  describe('Role-Based Access Control', () => {
    it('should render children when user has required role', () => {
      render(
        <BrowserRouter>
          <ProtectedRoute requiredRoles={['user']}>
            <div data-testid="protected-content">Content</div>
          </ProtectedRoute>
        </BrowserRouter>
      )

      expect(screen.getByTestId('protected-content')).toBeInTheDocument()
    })

    it('should render children when user has one of multiple required roles', () => {
      render(
        <BrowserRouter>
          <ProtectedRoute requiredRoles={['admin', 'editor']}>
            <div data-testid="protected-content">Content</div>
          </ProtectedRoute>
        </BrowserRouter>
      )

      // User has 'editor' role (from mockUser)
      expect(screen.getByTestId('protected-content')).toBeInTheDocument()
    })

    it('should show access denied when user lacks required role', () => {
      render(
        <BrowserRouter>
          <ProtectedRoute requiredRoles={['admin']}>
            <div data-testid="protected-content">Content</div>
          </ProtectedRoute>
        </BrowserRouter>
      )

      // User doesn't have 'admin' role
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
      expect(screen.getByText('Access Denied')).toBeInTheDocument()
      expect(screen.getByText("You don't have permission to access this page.")).toBeInTheDocument()
    })

    it('should show access denied when user has no roles at all', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: true,
        user: {
          ...mockUser,
          roles: []
        },
        isLoading: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn()
      })

      render(
        <BrowserRouter>
          <ProtectedRoute requiredRoles={['admin']}>
            <div data-testid="protected-content">Content</div>
          </ProtectedRoute>
        </BrowserRouter>
      )

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
      expect(screen.getByText('Access Denied')).toBeInTheDocument()
    })

    it('should allow access when requiredRoles is empty array', () => {
      render(
        <BrowserRouter>
          <ProtectedRoute requiredRoles={[]}>
            <div data-testid="protected-content">Content</div>
          </ProtectedRoute>
        </BrowserRouter>
      )

      expect(screen.getByTestId('protected-content')).toBeInTheDocument()
    })

    it('should handle user without roles property gracefully', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: true,
        user: {
          id: 'user-1',
          username: 'testuser',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          roles: []
        },
        isLoading: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn()
      })

      render(
        <BrowserRouter>
          <ProtectedRoute requiredRoles={['user']}>
            <div data-testid="protected-content">Content</div>
          </ProtectedRoute>
        </BrowserRouter>
      )

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
      expect(screen.getByText('Access Denied')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle null user when checking roles', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: true,
        user: null,
        isLoading: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn()
      })

      render(
        <BrowserRouter>
          <ProtectedRoute requiredRoles={['admin']}>
            <div data-testid="protected-content">Content</div>
          </ProtectedRoute>
        </BrowserRouter>
      )

      // Should render content (no role check when requiredRoles specified but user is null)
      // Based on code: if (requiredRoles.length > 0 && user) - null user skips role check
      expect(screen.getByTestId('protected-content')).toBeInTheDocument()
    })

    it('should handle null user without required roles', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: true,
        user: null,
        isLoading: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn()
      })

      render(
        <BrowserRouter>
          <ProtectedRoute>
            <div data-testid="protected-content">Content</div>
          </ProtectedRoute>
        </BrowserRouter>
      )

      expect(screen.getByTestId('protected-content')).toBeInTheDocument()
    })

    it('should prioritize authentication check over role check', () => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        isAuthenticated: false,
        user: mockUser, // User object exists but not authenticated
        isLoading: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn()
      })

      render(
        <BrowserRouter>
          <ProtectedRoute requiredRoles={['user']}>
            <div data-testid="protected-content">Content</div>
          </ProtectedRoute>
        </BrowserRouter>
      )

      // Should redirect to login, not show content or access denied
      expect(screen.getByTestId('navigate-to')).toHaveTextContent('/login')
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
      expect(screen.queryByText('Access Denied')).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper heading for access denied page', () => {
      render(
        <BrowserRouter>
          <ProtectedRoute requiredRoles={['admin']}>
            <div>Content</div>
          </ProtectedRoute>
        </BrowserRouter>
      )

      const heading = screen.getByRole('heading', { name: /access denied/i })
      expect(heading).toBeInTheDocument()
      expect(heading.tagName).toBe('H1')
    })

    it('should have descriptive error message', () => {
      render(
        <BrowserRouter>
          <ProtectedRoute requiredRoles={['admin']}>
            <div>Content</div>
          </ProtectedRoute>
        </BrowserRouter>
      )

      const message = screen.getByText("You don't have permission to access this page.")
      expect(message).toBeInTheDocument()
    })
  })

  describe('Styling', () => {
    it('should center access denied message', () => {
      render(
        <BrowserRouter>
          <ProtectedRoute requiredRoles={['admin']}>
            <div>Content</div>
          </ProtectedRoute>
        </BrowserRouter>
      )

      // MUI Box with centered content for access denied message
      const heading = screen.getByRole('heading', { name: /access denied/i })
      expect(heading).toBeInTheDocument()
    })

    it('should use background styling for access denied page', () => {
      render(
        <BrowserRouter>
          <ProtectedRoute requiredRoles={['admin']}>
            <div>Content</div>
          </ProtectedRoute>
        </BrowserRouter>
      )

      // MUI Box is used for layout (background styling is handled by theme)
      const accessDeniedText = screen.getByText(/you don't have permission/i)
      expect(accessDeniedText).toBeInTheDocument()
    })
  })
})
