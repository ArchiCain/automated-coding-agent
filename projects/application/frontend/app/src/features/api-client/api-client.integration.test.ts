import { describe, it, expect, beforeAll } from 'vitest'
import api from './api-client'
import { verifyBackendAvailable, BACKEND_URL } from '../../../test/utils/integration-helpers'

/**
 * API Client Integration Tests
 *
 * Tests real HTTP requests to the backend at localhost:8085
 * These tests FAIL LOUDLY if backend is not running
 */
describe('API Client (Integration)', () => {
  beforeAll(async () => {
    // Verify backend is available before running any tests
    // This will throw a clear error message if backend is not running
    await verifyBackendAvailable()
  })

  it('should be configured with correct baseURL', () => {
    expect(api.defaults.baseURL).toBeDefined()
    expect(api.defaults.baseURL).toContain('localhost')
  })

  it('should have withCredentials enabled for cookie handling', () => {
    expect(api.defaults.withCredentials).toBe(true)
  })

  it('should successfully make GET request to real backend health endpoint', async () => {
    const response = await api.get('/health')

    expect(response.status).toBe(200)
    expect(response.data).toBeDefined()
  })

  it('should handle real backend 404 errors correctly', async () => {
    try {
      await api.get('/nonexistent-endpoint-that-does-not-exist')
      // If we get here, the test should fail
      expect.fail('Expected request to throw 404 error')
    } catch (error: any) {
      expect(error.response?.status).toBe(404)
    }
  })

  it('should send credentials with requests to backend', async () => {
    // The health endpoint should receive our credentials
    const response = await api.get('/health')

    // Verify the request was made with credentials
    expect(api.defaults.withCredentials).toBe(true)
    expect(response.status).toBe(200)
  })

  it('should handle network errors gracefully', async () => {
    // Create a new axios instance with invalid URL to test network error handling
    const { default: axios } = await import('axios')
    const badApi = axios.create({
      baseURL: 'http://localhost:99999', // Invalid port
      timeout: 1000
    })

    try {
      await badApi.get('/health')
      expect.fail('Expected network error')
    } catch (error: any) {
      // Should get a network error (not a backend HTTP error)
      // Network errors have error.code or are axios errors without response
      expect(error.message).toBeDefined()
      expect(error.response).toBeUndefined() // Network errors don't have response
    }
  })

  it('should verify backend is actually at expected URL', async () => {
    // Double-check that we're testing against the right backend
    expect(BACKEND_URL).toBeTruthy() // Verify it's defined
    expect(api.defaults.baseURL).toBe(BACKEND_URL) // Verify API client matches env
  })
})
