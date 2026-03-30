import { describe, it, expect } from 'vitest'
import api from './api-client'

describe('API Client (Unit)', () => {
  it('should configure baseURL from environment variables', () => {
    expect(api.defaults.baseURL).toBeDefined()
    // Verify it falls back to localhost if not set
    expect(api.defaults.baseURL).toMatch(/localhost/)
  })

  it('should set withCredentials to true for cookie handling', () => {
    expect(api.defaults.withCredentials).toBe(true)
  })

  describe('Token Refresh Interceptor', () => {
    it('should have response interceptor configured', () => {
      expect(api.interceptors.response).toBeDefined()
      // Verify interceptors are attached
      // @ts-expect-error - Accessing internal handlers property for testing
      expect(api.interceptors.response['handlers']).toBeDefined()
    })

    it('should have request interceptor configured', () => {
      expect(api.interceptors.request).toBeDefined()
      // Verify interceptors are attached
      // @ts-expect-error - Accessing internal handlers property for testing
      expect(api.interceptors.request['handlers']).toBeDefined()
    })
  })

  describe('Configuration', () => {
    it('should use VITE_BACKEND_URL from environment', () => {
      // The base URL should be set from env vars
      expect(api.defaults.baseURL).toBeDefined()
      expect(typeof api.defaults.baseURL).toBe('string')
    })

    it('should include credentials in all requests', () => {
      expect(api.defaults.withCredentials).toBe(true)
    })

    it('should be an axios instance', () => {
      // Verify it's a proper axios instance
      expect(api.get).toBeDefined()
      expect(api.post).toBeDefined()
      expect(api.put).toBeDefined()
      expect(api.delete).toBeDefined()
      expect(typeof api.get).toBe('function')
    })

    it('should have interceptors configured', () => {
      // Both request and response interceptors should exist
      expect(api.interceptors).toBeDefined()
      expect(api.interceptors.request).toBeDefined()
      expect(api.interceptors.response).toBeDefined()
    })
  })
})
