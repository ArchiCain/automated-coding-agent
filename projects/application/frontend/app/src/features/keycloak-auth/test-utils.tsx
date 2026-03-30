import { render } from '@testing-library/react'
import { ReactElement } from 'react'
import { createContext } from 'react'
import { vi } from 'vitest'
import { User, AuthContextType } from './types'

// Create AuthContext for testing (matches the real implementation)
const AuthContext = createContext<AuthContextType | undefined>(undefined)

const mockUser: User = {
  id: 'test-user-id',
  username: 'testuser',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  roles: ['user']
}

export function renderWithAuth(
  ui: ReactElement,
  options?: {
    isAuthenticated?: boolean
    user?: User | null
    isLoading?: boolean
    error?: string | null
  }
) {
  const mockAuthContext: AuthContextType = {
    isAuthenticated: options?.isAuthenticated ?? true,
    user: options?.user !== undefined ? options.user : mockUser,
    isLoading: options?.isLoading ?? false,
    error: options?.error ?? null,
    login: vi.fn(),
    logout: vi.fn(),
    checkAuth: vi.fn(),
    permissions: []
  }

  return render(
    <AuthContext.Provider value={mockAuthContext}>
      {ui}
    </AuthContext.Provider>
  )
}

export { mockUser }
