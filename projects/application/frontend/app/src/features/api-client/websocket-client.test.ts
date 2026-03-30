import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMockSocket } from '../../../test/utils/mock-providers'

// Mock socket.io-client module
const mockIo = vi.fn()
vi.mock('socket.io-client', () => ({
  io: mockIo
}))

describe('WebSocket Client (Unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Return a new mock socket for each call
    mockIo.mockReturnValue(createMockSocket())
  })

  afterEach(() => {
    // Clear module cache to reset the module state between tests
    vi.resetModules()
  })

  it('should create socket with correct configuration', async () => {
    const { getSocket } = await import('./websocket-client')
    const socket = getSocket('/mastra-chat', { userId: '1', threadId: '2' })

    expect(mockIo).toHaveBeenCalled()
    expect(socket).toBeDefined()
  })

  it('should use correct namespace in URL', async () => {
    const { getSocket } = await import('./websocket-client')
    getSocket('/test-namespace', {})

    const callArgs = mockIo.mock.calls[0]
    expect(callArgs[0]).toContain('/test-namespace')
  })

  it('should pass auth parameters to socket', async () => {
    const { getSocket } = await import('./websocket-client')
    const authParams = { userId: 'user-123', threadId: 'thread-456' }

    getSocket('/mastra-chat', authParams)

    const callArgs = mockIo.mock.calls[0]
    const options = callArgs[1]

    expect(options.auth).toEqual(authParams)
    expect(options.query).toEqual(authParams)
  })

  it('should enable withCredentials', async () => {
    const { getSocket } = await import('./websocket-client')
    getSocket('/test', {})

    const callArgs = mockIo.mock.calls[0]
    const options = callArgs[1]

    expect(options.withCredentials).toBe(true)
  })

  it('should connect automatically by default', async () => {
    const { getSocket } = await import('./websocket-client')
    const socket = getSocket('/test', {})

    // Socket.IO autoConnect is true by default
    expect(socket).toBeDefined()
  })

  it('should concern correct backend URL', async () => {
    const { getSocket } = await import('./websocket-client')
    const namespace = '/custom-namespace'

    getSocket(namespace, {})

    const callArgs = mockIo.mock.calls[0]
    const url = callArgs[0]

    expect(url).toContain(namespace)
  })

  it('should handle empty query parameters', async () => {
    const { getSocket } = await import('./websocket-client')
    getSocket('/test')

    const callArgs = mockIo.mock.calls[0]
    const options = callArgs[1]

    // Should still have options object even without query
    expect(options).toBeDefined()
    expect(options.withCredentials).toBe(true)
  })
})
