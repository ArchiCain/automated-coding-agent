import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { act } from 'react'
import { ChatProvider, useChatContext } from './ChatProvider'
import { createMockSocket } from '../../../../test/utils/mock-providers'

// Test component to access chat context
function TestComponent() {
  const { isConnected, userId, threadId, socket } = useChatContext()
  return (
    <div>
      <div data-testid="connected">{String(isConnected)}</div>
      <div data-testid="userId">{userId}</div>
      <div data-testid="threadId">{threadId}</div>
      <div data-testid="socket">{socket ? 'present' : 'absent'}</div>
    </div>
  )
}

// Mock the websocket client
const mockSocket = createMockSocket()

vi.mock('@/features/api-client/websocket-client', () => ({
  getSocket: vi.fn(() => mockSocket)
}))

describe('ChatProvider (Unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSocket.connected = false
  })

  it('should throw error when useChatContext is used outside ChatProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      render(<TestComponent />)
    }).toThrow('useChatContext must be used within a ChatProvider')

    consoleError.mockRestore()
  })

  it('should provide chat context with userId and threadId', () => {
    render(
      <ChatProvider userId="user-123" threadId="thread-456">
        <TestComponent />
      </ChatProvider>
    )

    expect(screen.getByTestId('userId').textContent).toBe('user-123')
    expect(screen.getByTestId('threadId').textContent).toBe('thread-456')
  })

  it('should initialize socket connection', async () => {
    const { getSocket } = await import('@/features/api-client/websocket-client')

    render(
      <ChatProvider userId="user-1" threadId="thread-1">
        <TestComponent />
      </ChatProvider>
    )

    expect(getSocket).toHaveBeenCalledWith('/mastra-chat', {
      userId: 'user-1',
      threadId: 'thread-1'
    })
  })

  it('should provide socket instance to children', () => {
    render(
      <ChatProvider userId="user-1" threadId="thread-1">
        <TestComponent />
      </ChatProvider>
    )

    expect(screen.getByTestId('socket').textContent).toBe('present')
  })

  it('should initialize with disconnected state', () => {
    mockSocket.connected = false

    render(
      <ChatProvider userId="user-1" threadId="thread-1">
        <TestComponent />
      </ChatProvider>
    )

    expect(screen.getByTestId('connected').textContent).toBe('false')
  })

  it('should update connection state on socket connect event', async () => {
    render(
      <ChatProvider userId="user-1" threadId="thread-1">
        <TestComponent />
      </ChatProvider>
    )

    // Wait for initial render to complete
    await waitFor(() => {
      expect(screen.getByTestId('connected')).toBeInTheDocument()
    })

    // Initially disconnected
    expect(screen.getByTestId('connected').textContent).toBe('false')

    // Trigger connect event wrapped in act
    await act(async () => {
      mockSocket._trigger('connect', {})
    })

    await waitFor(() => {
      expect(screen.getByTestId('connected').textContent).toBe('true')
    })
  })

  it('should update connection state on socket disconnect event', async () => {
    mockSocket.connected = true

    render(
      <ChatProvider userId="user-1" threadId="thread-1">
        <TestComponent />
      </ChatProvider>
    )

    // Wait for initial render to complete
    await waitFor(() => {
      expect(screen.getByTestId('connected')).toBeInTheDocument()
    })

    // Trigger disconnect event wrapped in act
    await act(async () => {
      mockSocket._trigger('disconnect', {})
    })

    await waitFor(() => {
      expect(screen.getByTestId('connected').textContent).toBe('false')
    })
  })

  it('should handle socket connect_error event', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ChatProvider userId="user-1" threadId="thread-1">
        <TestComponent />
      </ChatProvider>
    )

    // Trigger error event
    const error = new Error('Connection failed')
    mockSocket._trigger('connect_error', error)

    await waitFor(() => {
      expect(screen.getByTestId('connected').textContent).toBe('false')
      expect(consoleError).toHaveBeenCalledWith('Mastra Chat WebSocket error:', error)
    })

    consoleError.mockRestore()
  })

  it('should set connected state if socket is already connected', () => {
    mockSocket.connected = true

    render(
      <ChatProvider userId="user-1" threadId="thread-1">
        <TestComponent />
      </ChatProvider>
    )

    // Should detect already connected socket
    waitFor(() => {
      expect(screen.getByTestId('connected').textContent).toBe('true')
    })
  })

  it('should not initialize socket if userId or threadId is missing', () => {
    render(
      <ChatProvider userId="" threadId="thread-1">
        <TestComponent />
      </ChatProvider>
    )

    // Component should render but socket should be null
    expect(screen.getByTestId('socket').textContent).toBe('absent')
  })
})
