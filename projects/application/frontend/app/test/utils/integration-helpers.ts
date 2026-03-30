/**
 * Integration test utilities for connecting to real backend services
 */

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL

/**
 * Verify that the backend is available before running integration tests
 * Fails loudly if backend is not accessible
 */
export async function verifyBackendAvailable(): Promise<void> {
  try {
    const response = await fetch(`${BACKEND_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    })

    if (!response.ok) {
      throw new Error(`Backend returned status ${response.status}`)
    }
  } catch (error) {
    const errorMessage = `
      ============================================================
      INTEGRATION TEST SETUP FAILURE
      ============================================================

      Backend is not available at ${BACKEND_URL}

      Integration tests require all services to be running.

      Please start the backend before running integration tests:

        task start-local

      Error: ${error instanceof Error ? error.message : String(error)}

      ============================================================
    `
    throw new Error(errorMessage)
  }
}

/**
 * Get admin credentials for testing
 * These credentials are authenticated by the backend against Keycloak
 */
export const TEST_ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'admin'
}

/**
 * Wait for a condition to be true with timeout
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 10000, interval = 100 } = options
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, interval))
  }

  throw new Error(`Condition not met within ${timeout}ms`)
}
