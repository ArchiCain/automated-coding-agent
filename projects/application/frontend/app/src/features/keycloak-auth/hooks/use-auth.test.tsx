import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAuth, AuthProvider } from './use-auth'
import { ReactNode } from 'react'

// Mock the auth API
vi.mock('../services/auth.api', () => ({
  authApi: {
    login: vi.fn(),
    logout: vi.fn(),
    checkAuth: vi.fn()
  }
}))

describe('useAuth (Unit)', () => {
  it('should throw error when used outside AuthProvider', () => {
    // Suppress console.error for this test
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      renderHook(() => useAuth())
    }).toThrow('useAuth must be used within an AuthProvider')

    consoleError.mockRestore()
  })

  it('should return authentication context when used within AuthProvider', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    )

    const { result } = renderHook(() => useAuth(), { wrapper })

    // Wait for async checkAuth to complete
    await waitFor(() => {
      expect(result.current).toBeDefined()
      expect(result.current.login).toBeDefined()
      expect(result.current.logout).toBeDefined()
      expect(result.current.checkAuth).toBeDefined()
    })
  })

  it('should provide isAuthenticated boolean', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    )

    const { result } = renderHook(() => useAuth(), { wrapper })

    // Wait for async checkAuth to complete
    await waitFor(() => {
      expect(typeof result.current.isAuthenticated).toBe('boolean')
    })
  })

  it('should provide isLoading boolean', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    )

    const { result } = renderHook(() => useAuth(), { wrapper })

    // Wait for async checkAuth to complete
    await waitFor(() => {
      expect(typeof result.current.isLoading).toBe('boolean')
    })
  })

  it('should provide user object or null', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    )

    const { result } = renderHook(() => useAuth(), { wrapper })

    // Wait for async checkAuth to complete
    await waitFor(() => {
      // User should be null or an object
      expect(result.current.user === null || typeof result.current.user === 'object').toBe(true)
    })
  })

  it('should provide error string or null', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    )

    const { result } = renderHook(() => useAuth(), { wrapper })

    // Wait for async checkAuth to complete
    await waitFor(() => {
      // Error should be null or a string
      expect(result.current.error === null || typeof result.current.error === 'string').toBe(true)
    })
  })

  it('should expose login function', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    )

    const { result } = renderHook(() => useAuth(), { wrapper })

    // Wait for async checkAuth to complete
    await waitFor(() => {
      expect(typeof result.current.login).toBe('function')
    })
  })

  it('should expose logout function', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    )

    const { result } = renderHook(() => useAuth(), { wrapper })

    // Wait for async checkAuth to complete
    await waitFor(() => {
      expect(typeof result.current.logout).toBe('function')
    })
  })

  it('should expose checkAuth function', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    )

    const { result } = renderHook(() => useAuth(), { wrapper })

    // Wait for async checkAuth to complete
    await waitFor(() => {
      expect(typeof result.current.checkAuth).toBe('function')
    })
  })
})
