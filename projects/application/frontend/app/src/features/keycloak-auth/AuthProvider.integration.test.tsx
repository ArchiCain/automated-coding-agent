import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from './hooks/use-auth'
import { verifyBackendAvailable, TEST_ADMIN_CREDENTIALS } from '../../../test/utils/integration-helpers'

/**
 * AuthProvider Integration Tests
 *
 * Tests real authentication against Keycloak via backend at localhost:8085
 * These tests FAIL LOUDLY if backend/Keycloak is not running
 */
describe('AuthProvider (Integration)', () => {
  beforeAll(async () => {
    // Verify backend is available (which connects to Keycloak)
    await verifyBackendAvailable()
  })

  // Test component that uses the auth context
  function TestComponent() {
    const { isAuthenticated, isLoading, user, login, logout, error } = useAuth()

    return (
      <div>
        <div data-testid="loading-state">{isLoading ? 'loading' : 'ready'}</div>
        <div data-testid="auth-state">
          {isAuthenticated ? 'authenticated' : 'not-authenticated'}
        </div>
        <div data-testid="user-info">{user?.username || 'no-user'}</div>
        {error && <div data-testid="error-message">{error}</div>}
        <button
          data-testid="login-button"
          onClick={() => login(TEST_ADMIN_CREDENTIALS)}
        >
          Login
        </button>
        <button data-testid="logout-button" onClick={() => logout()}>
          Logout
        </button>
      </div>
    )
  }

  it('should provide authentication context to children', () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    // Should render the component
    expect(screen.getByTestId('auth-state')).toBeInTheDocument()
    expect(screen.getByTestId('loading-state')).toBeInTheDocument()
  })

  it('should initialize with loading state and then become ready', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    // Eventually should finish loading
    await waitFor(
      () => {
        const loadingState = screen.getByTestId('loading-state')
        expect(loadingState.textContent).toBe('ready')
      },
      { timeout: 10000 }
    )
  })

  it('should authenticate with real Keycloak using admin credentials', async () => {
    const user = userEvent.setup()

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    // Wait for initial loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading-state').textContent).toBe('ready')
    })

    // Initial state should be not authenticated
    expect(screen.getByTestId('auth-state').textContent).toBe('not-authenticated')

    // Click login button
    const loginButton = screen.getByTestId('login-button')
    await user.click(loginButton)

    // Wait for authentication to complete
    // This tests real Keycloak authentication flow
    await waitFor(
      () => {
        const authState = screen.getByTestId('auth-state')
        expect(authState.textContent).toBe('authenticated')
      },
      { timeout: 15000 }
    )

    // Verify user data from real Keycloak
    await waitFor(() => {
      const userInfo = screen.getByTestId('user-info')
      expect(userInfo.textContent).not.toBe('no-user')
      expect(userInfo.textContent).toBe(TEST_ADMIN_CREDENTIALS.username)
    })
  }, 30000) // Increased timeout for real auth flow

  it('should handle logout correctly', async () => {
    const user = userEvent.setup()

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    // Wait for ready state
    await waitFor(() => {
      expect(screen.getByTestId('loading-state').textContent).toBe('ready')
    })

    // Login first
    const loginButton = screen.getByTestId('login-button')
    await user.click(loginButton)

    // Wait for authentication
    await waitFor(
      () => {
        expect(screen.getByTestId('auth-state').textContent).toBe('authenticated')
      },
      { timeout: 15000 }
    )

    // Now logout
    const logoutButton = screen.getByTestId('logout-button')
    await user.click(logoutButton)

    // Verify logged out
    await waitFor(
      () => {
        expect(screen.getByTestId('auth-state').textContent).toBe('not-authenticated')
        expect(screen.getByTestId('user-info').textContent).toBe('no-user')
      },
      { timeout: 10000 }
    )
  }, 40000) // Increased timeout for login + logout

  it('should handle invalid credentials gracefully', async () => {
    const user = userEvent.setup()

    function InvalidLoginTest() {
      const { login, error } = useAuth()

      return (
        <div>
          {error && <div data-testid="error-message">{error}</div>}
          <button
            data-testid="invalid-login-button"
            onClick={() =>
              login({ username: 'invalid', password: 'wrong' }).catch(() => {
                // Expected to fail
              })
            }
          >
            Invalid Login
          </button>
        </div>
      )
    }

    render(
      <AuthProvider>
        <InvalidLoginTest />
      </AuthProvider>
    )

    // Try to login with invalid credentials
    const invalidLoginButton = screen.getByTestId('invalid-login-button')
    await user.click(invalidLoginButton)

    // Should show error message
    await waitFor(
      () => {
        const errorMessage = screen.getByTestId('error-message')
        expect(errorMessage).toBeInTheDocument()
        expect(errorMessage.textContent).toBeTruthy()
      },
      { timeout: 10000 }
    )
  }, 20000)

  it('should persist authentication state across re-renders', async () => {
    const user = userEvent.setup()

    const { rerender } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    // Wait for ready
    await waitFor(() => {
      expect(screen.getByTestId('loading-state').textContent).toBe('ready')
    })

    // Login
    await user.click(screen.getByTestId('login-button'))

    // Wait for auth
    await waitFor(
      () => {
        expect(screen.getByTestId('auth-state').textContent).toBe('authenticated')
      },
      { timeout: 15000 }
    )

    // Force re-render
    rerender(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    // Auth state should persist (after initial check)
    await waitFor(
      () => {
        expect(screen.getByTestId('loading-state').textContent).toBe('ready')
      },
      { timeout: 10000 }
    )

    // Should still be authenticated
    await waitFor(
      () => {
        expect(screen.getByTestId('auth-state').textContent).toBe('authenticated')
      },
      { timeout: 5000 }
    )
  }, 40000)
})
