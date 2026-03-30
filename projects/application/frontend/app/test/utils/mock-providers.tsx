import { vi } from 'vitest'

// Mock Socket.io client
export function createMockSocket() {
  const eventHandlers = new Map<string, any>()

  const mockSocket: any = {
    on: vi.fn((event: string, handler: any) => {
      eventHandlers.set(event, handler)
      return mockSocket
    }),
    off: vi.fn((event) => {
      eventHandlers.delete(event)
      return mockSocket
    }),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connected: true,
    id: 'mock-socket-id',

    // Test helper to trigger events
    _trigger: (event: string, data: any) => {
      const handler = eventHandlers.get(event)
      if (handler) handler(data)
    }
  }

  return mockSocket
}

// Mock axios instance
export function createMockApiClient() {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn() }
    },
    defaults: {
      baseURL: 'http://localhost:8085',
      withCredentials: true
    }
  }
}
