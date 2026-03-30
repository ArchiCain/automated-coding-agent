import { render } from '@testing-library/react'
import { ReactElement } from 'react'
import { vi } from 'vitest'
import { createMockSocket } from '../../../../test/utils/mock-providers'

// Mock the websocket-client module
export function mockWebSocketClient() {
  const mockSocket = createMockSocket()

  vi.mock('@/features/api-client/websocket-client', () => ({
    getSocket: vi.fn(() => mockSocket)
  }))

  return mockSocket
}

export function renderWithChatProvider(
  ui: ReactElement,
  options?: { userId?: string; threadId?: string; mockSocket?: any }
) {
  const mockSocket = options?.mockSocket ?? createMockSocket()

  // Mock getSocket to return our mock
  vi.mock('@/features/api-client/websocket-client', () => ({
    getSocket: vi.fn(() => mockSocket)
  }))

  // Import ChatProvider after mocking
  const { ChatProvider } = require('./ChatProvider')

  return {
    ...render(
      <ChatProvider
        userId={options?.userId ?? 'test-user'}
        threadId={options?.threadId ?? 'test-thread'}
      >
        {ui}
      </ChatProvider>
    ),
    mockSocket
  }
}
