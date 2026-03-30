import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from './hooks/use-auth'

// Test component to access auth context
function TestComponent() {
  const { isAuthenticated, user, isLoading, error } = useAuth()
  return (
    <div>
      <div data-testid="authenticated">{String(isAuthenticated)}</div>
      <div data-testid="user">{user?.username || 'none'}</div>
      <div data-testid="loading">{String(isLoading)}</div>
      <div data-testid="error">{error || 'none'}</div>
    </div>
  )
}

// Mock the auth API
vi.mock('./services/auth.api', () => ({
  authApi: {
    login: vi.fn(),
    logout: vi.fn(),
    checkAuth: vi.fn()
  }
}))

describe('AuthProvider (Unit)', () => {
  let authApi: any

  beforeEach(async () => {
    // Import the mocked module
    const module = await import('./services/auth.api')
    authApi = module.authApi

    vi.clearAllMocks()
    // Default: checkAuth returns null (not authenticated)
    authApi.checkAuth.mockResolvedValue(null)
  })

  it('should render children', async () => {
    render(
      <AuthProvider>
        <div data-testid="child">Test Child</div>
      </AuthProvider>
    )

    // Wait for async checkAuth to complete
    await waitFor(() => {
      expect(screen.getByTestId('child')).toBeInTheDocument()
    })
  })

  it('should provide authentication context to children', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    // Wait for async checkAuth to complete
    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toBeInTheDocument()
      expect(screen.getByTestId('user')).toBeInTheDocument()
      expect(screen.getByTestId('loading')).toBeInTheDocument()
      expect(screen.getByTestId('error')).toBeInTheDocument()
    })
  })

  it('should initialize with loading state', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    // Initially should be loading
    const loadingElement = screen.getByTestId('loading')
    expect(loadingElement.textContent).toBe('true')

    // Wait for async checkAuth to complete to avoid act warning
    await waitFor(() => {
      expect(authApi.checkAuth).toHaveBeenCalled()
    })
  })

  it('should call checkAuth on mount', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(authApi.checkAuth).toHaveBeenCalled()
    })
  })

  it('should set unauthenticated state when checkAuth returns null', async () => {
    authApi.checkAuth.mockResolvedValue(null)

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('false')
      expect(screen.getByTestId('user').textContent).toBe('none')
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })
  })

  it('should set authenticated state when checkAuth returns user', async () => {
    const mockUser = {
      id: '1',
      username: 'testuser',
      email: 'test@example.com',
      roles: ['user']
    }
    authApi.checkAuth.mockResolvedValue(mockUser)

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('true')
      expect(screen.getByTestId('user').textContent).toBe('testuser')
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })
  })

  it('should handle checkAuth errors gracefully', async () => {
    authApi.checkAuth.mockRejectedValue(new Error('Network error'))

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('false')
      expect(screen.getByTestId('user').textContent).toBe('none')
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })
  })

  it('should clear error when checkAuth succeeds', async () => {
    authApi.checkAuth.mockResolvedValue(null)

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toBe('none')
    })
  })
})
