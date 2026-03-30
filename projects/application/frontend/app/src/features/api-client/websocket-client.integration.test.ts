import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { Socket } from 'socket.io-client'
import { getSocket } from './websocket-client'
import { verifyBackendAvailable, BACKEND_URL } from '../../../test/utils/integration-helpers'

/**
 * WebSocket Client Integration Tests
 *
 * Tests real WebSocket connections to the backend at localhost:8085
 * These tests FAIL LOUDLY if backend is not running
 */
describe('WebSocket Client (Integration)', () => {
  let socket: Socket | null = null

  beforeAll(async () => {
    // Verify backend is available before running any tests
    await verifyBackendAvailable()
  })

  afterEach(() => {
    // Cleanup: disconnect socket after each test
    if (socket && socket.connected) {
      socket.disconnect()
    }
    socket = null
  })

  it('should connect to real backend WebSocket namespace', async () => {
    return new Promise<void>((resolve, reject) => {
      socket = getSocket('/mastra-chat', {
        userId: 'test-user',
        threadId: 'test-thread'
      })

      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout - backend may not be running'))
      }, 10000)

      socket.on('connect', () => {
        clearTimeout(timeout)
        expect(socket!.connected).toBe(true)
        expect(socket!.id).toBeDefined()
        resolve()
      })

      socket.on('connect_error', (error) => {
        clearTimeout(timeout)
        reject(new Error(`Failed to connect to backend WebSocket: ${error.message}`))
      })
    })
  })

  it('should create socket with correct namespace URL', () => {
    socket = getSocket('/mastra-chat', {
      userId: 'test-user',
      threadId: 'test-thread'
    })

    // Verify socket is created (connection happens automatically)
    expect(socket).toBeDefined()
    // @ts-expect-error - Accessing private uri property for testing
    expect(socket.io.uri).toContain('localhost')
  })

  it('should pass authentication parameters to backend', async () => {
    return new Promise<void>((resolve, reject) => {
      const testUserId = 'integration-test-user'
      const testThreadId = 'integration-test-thread'

      socket = getSocket('/mastra-chat', {
        userId: testUserId,
        threadId: testThreadId
      })

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'))
      }, 10000)

      socket.on('connect', () => {
        clearTimeout(timeout)
        // Socket connected with auth parameters
        expect(socket!.connected).toBe(true)
        resolve()
      })

      socket.on('connect_error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })
    })
  })

  it('should handle disconnection from backend', async () => {
    return new Promise<void>((resolve, reject) => {
      socket = getSocket('/mastra-chat', {
        userId: 'test-user',
        threadId: 'test-thread'
      })

      const timeout = setTimeout(() => {
        reject(new Error('Test timeout'))
      }, 10000)

      socket.on('connect', () => {
        // Once connected, disconnect and verify
        socket!.on('disconnect', (reason) => {
          clearTimeout(timeout)
          expect(socket!.connected).toBe(false)
          expect(reason).toBeDefined()
          resolve()
        })

        // Trigger disconnect
        socket!.disconnect()
      })

      socket.on('connect_error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })
    })
  })

  it('should support multiple simultaneous socket connections', async () => {
    const sockets: Socket[] = []

    try {
      // Create multiple connections
      const socket1 = getSocket('/mastra-chat', {
        userId: 'user-1',
        threadId: 'thread-1'
      })
      const socket2 = getSocket('/mastra-chat', {
        userId: 'user-2',
        threadId: 'thread-2'
      })

      sockets.push(socket1, socket2)

      // Wait for both to connect
      await Promise.all([
        new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Socket 1 timeout')), 10000)
          socket1.on('connect', () => {
            clearTimeout(timeout)
            resolve()
          })
          socket1.on('connect_error', (error) => {
            clearTimeout(timeout)
            reject(error)
          })
        }),
        new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Socket 2 timeout')), 10000)
          socket2.on('connect', () => {
            clearTimeout(timeout)
            resolve()
          })
          socket2.on('connect_error', (error) => {
            clearTimeout(timeout)
            reject(error)
          })
        })
      ])

      // Verify both are connected
      expect(socket1.connected).toBe(true)
      expect(socket2.connected).toBe(true)
      // Verify they have different socket IDs
      expect(socket1.id).not.toBe(socket2.id)
    } finally {
      // Cleanup all sockets
      sockets.forEach(s => s.disconnect())
    }
  })

  it('should verify backend URL is correct', () => {
    expect(BACKEND_URL).toBeTruthy() // Verify backend URL is defined from env
  })
})
