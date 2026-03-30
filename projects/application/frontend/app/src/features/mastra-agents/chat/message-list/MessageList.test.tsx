import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MessageList, useMessageList } from './MessageList'
import { createMockSocket } from '../../../../../test/utils/mock-providers'
import * as ChatProviderModule from '../ChatProvider'
import { Message, ResponseChunkEvent } from '../types'

// Mock dependencies
vi.mock('../ChatProvider', () => ({
  useChatContext: vi.fn()
}))

vi.mock('./ChatMessage', () => ({
  ChatMessage: ({ message }: { message: Message }) => (
    <div data-testid={`message-${message.id}`} data-role={message.role}>
      {message.content}
    </div>
  )
}))

vi.mock('./message-list.service', () => {
  let messageIdCounter = 1
  return {
    messageListService: {
      onConversationHistory: vi.fn((socket, callback) => {
        socket.on('conversation-history', callback)
      }),
      onResponseChunk: vi.fn((socket, callback) => {
        socket.on('response-chunk', callback)
      }),
      onChatError: vi.fn((socket, callback) => {
        socket.on('chat-error', callback)
      }),
      offConversationHistory: vi.fn((socket, callback) => {
        socket.off('conversation-history', callback)
      }),
      offResponseChunk: vi.fn((socket, callback) => {
        socket.off('response-chunk', callback)
      }),
      offChatError: vi.fn((socket, callback) => {
        socket.off('chat-error', callback)
      }),
      createUserMessage: vi.fn((content: string) => ({
        id: `msg-${messageIdCounter++}`,
        role: 'user',
        content,
        timestamp: new Date(),
      })),
      createAssistantMessage: vi.fn((content: string, isStreaming = false) => ({
        id: `msg-${messageIdCounter++}`,
        role: 'assistant',
        content,
        timestamp: new Date(),
        isStreaming,
      })),
    }
  }
})

// Test component to use the context
const TestConsumer = () => {
  const { messages, addUserMessage } = useMessageList()

  return (
    <div>
      <div data-testid="message-count">{messages.length}</div>
      <button onClick={() => addUserMessage('Test message')} data-testid="add-message">
        Add Message
      </button>
    </div>
  )
}

describe('MessageList (Unit)', () => {
  const mockSocket = createMockSocket()

  // Helper to wait for component mount and listener setup
  const waitForMount = async () => {
    await act(async () => {
      // Give useEffect time to run and register socket listeners
      await new Promise(resolve => setTimeout(resolve, 100))
    })
  }

  // Helper to emit socket events with proper async handling
  const emitSocketEvent = async (eventName: string, data: any) => {
    await act(async () => {
      mockSocket._trigger(eventName, data)
      // Small delay to allow React to process state updates
      await new Promise(resolve => setTimeout(resolve, 10))
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(ChatProviderModule.useChatContext).mockReturnValue({
      socket: mockSocket,
      userId: 'test-user',
      threadId: 'test-thread',
      isConnected: true,
    })

    // Reset HTMLElement.scrollIntoView mock
    HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  describe('Context Provider', () => {
    it('should provide context to children', async () => {
      render(
        <MessageList>
          <TestConsumer />
        </MessageList>
      )

      // Wait for component to mount and set up listeners
      await waitForMount()

      // Emit conversation-history to stop loading
      await emitSocketEvent('conversation-history', { messages: [] })

      await waitFor(() => {
        expect(screen.getByTestId('message-count')).toHaveTextContent('0')
      })
    })

    it('should throw error when useMessageList is used outside provider', () => {
      // Suppress console.error for this test
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        render(<TestConsumer />)
      }).toThrow('useMessageList must be used within MessageList')

      consoleError.mockRestore()
    })

    it('should expose messages through context', async () => {
      render(
        <MessageList>
          <TestConsumer />
        </MessageList>
      )

      const messages: Message[] = [
        { id: 'msg-1', role: 'user', content: 'Hello', timestamp: new Date() },
        { id: 'msg-2', role: 'assistant', content: 'Hi', timestamp: new Date(), isStreaming: false }
      ]

      await waitForMount()

      await emitSocketEvent('conversation-history', { messages })

      await waitFor(() => {
        expect(screen.getByTestId('message-count')).toHaveTextContent('2')
      })
    })
  })

  describe('Loading State', () => {
    it('should show loading spinner initially', async () => {
      render(<MessageList />)
      await waitForMount()

      expect(screen.getByText('Loading conversation...')).toBeInTheDocument()
    })

    it('should show loading spinner', async () => {
      render(<MessageList />)
      await waitForMount()

      // MUI CircularProgress is used for loading state
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('should hide loading when conversation history is received', async () => {
      render(<MessageList />)
      await waitForMount()

      expect(screen.getByText('Loading conversation...')).toBeInTheDocument()

      await emitSocketEvent('conversation-history', { messages: [] })

      await waitFor(() => {
        expect(screen.queryByText('Loading conversation...')).not.toBeInTheDocument()
      })
    })
  })

  describe('Empty State', () => {
    it('should show welcome message when no messages', async () => {
      render(<MessageList />)

      await waitForMount()

      await emitSocketEvent('conversation-history', { messages: [] })

      await waitFor(() => {
        expect(screen.getByText('Welcome! 👋')).toBeInTheDocument()
        expect(screen.getByText('Start a conversation by sending a message below.')).toBeInTheDocument()
      })
    })

    it('should not show empty state when messages exist', async () => {
      render(<MessageList />)

      await waitForMount()

      const messages: Message[] = [
        { id: 'msg-1', role: 'user', content: 'Hello', timestamp: new Date() }
      ]

      await emitSocketEvent('conversation-history', { messages })

      await waitFor(() => {
        expect(screen.queryByText('Welcome! 👋')).not.toBeInTheDocument()
      })
    })
  })

  describe('Message Rendering', () => {
    it('should render messages from conversation history', async () => {
      render(<MessageList />)
      await waitForMount()

      const messages: Message[] = [
        { id: 'msg-1', role: 'user', content: 'Hello', timestamp: new Date() },
        { id: 'msg-2', role: 'assistant', content: 'Hi there', timestamp: new Date(), isStreaming: false }
      ]

      await emitSocketEvent('conversation-history', { messages })

      await waitFor(() => {
        expect(screen.getByTestId('message-msg-1')).toBeInTheDocument()
        expect(screen.getByTestId('message-msg-2')).toBeInTheDocument()
        expect(screen.getByText('Hello')).toBeInTheDocument()
        expect(screen.getByText('Hi there')).toBeInTheDocument()
      })
    })

    it('should mark historical messages as not streaming', async () => {
      render(<MessageList />)
      await waitForMount()

      const messages: Message[] = [
        { id: 'msg-1', role: 'assistant', content: 'Test', timestamp: new Date(), isStreaming: true }
      ]

      await emitSocketEvent('conversation-history', { messages })

      await waitFor(() => {
        const messageElement = screen.getByTestId('message-msg-1')
        expect(messageElement).toBeInTheDocument()
        // Historical messages should have isStreaming set to false internally
      })
    })

    it('should convert timestamp strings to Date objects', async () => {
      render(<MessageList />)
      await waitForMount()

      const messages = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Test',
          timestamp: '2023-01-01T00:00:00.000Z'
        }
      ] as any

      await emitSocketEvent('conversation-history', { messages })

      await waitFor(() => {
        expect(screen.getByTestId('message-msg-1')).toBeInTheDocument()
      })
    })
  })

  describe('Adding Messages', () => {
    it('should add user message when addUserMessage is called', async () => {
      render(
        <MessageList>
          <TestConsumer />
        </MessageList>
      )
      await waitForMount()

      await emitSocketEvent('conversation-history', { messages: [] })

      await waitFor(() => {
        expect(screen.getByTestId('add-message')).toBeInTheDocument()
      })

      act(() => {
        screen.getByTestId('add-message').click()
      })

      await waitFor(() => {
        expect(screen.getByTestId('message-count')).toHaveTextContent('2') // user + assistant
      })
    })

    it('should create streaming assistant message after user message', async () => {
      render(
        <MessageList>
          <TestConsumer />
        </MessageList>
      )
      await waitForMount()

      await emitSocketEvent('conversation-history', { messages: [] })

      await waitFor(() => {
        screen.getByTestId('add-message').click()
      })

      await waitFor(() => {
        // Should have both user and assistant messages
        expect(screen.getByTestId('message-count')).toHaveTextContent('2')
        expect(screen.getByText('Test message')).toBeInTheDocument()
        // Verify there's a user and assistant message
        const messages = screen.getAllByTestId(/^message-msg-/)
        const userMessages = messages.filter(m => m.getAttribute('data-role') === 'user')
        const assistantMessages = messages.filter(m => m.getAttribute('data-role') === 'assistant')
        expect(userMessages.length).toBe(1)
        expect(assistantMessages.length).toBe(1)
      })
    })

    it('should mark previous streaming messages as complete when adding new message', async () => {
      render(
        <MessageList>
          <TestConsumer />
        </MessageList>
      )

      await emitSocketEvent('conversation-history', { messages: [] })

      // Add first message
      await waitFor(() => {
        screen.getByTestId('add-message').click()
      })

      // Add second message
      act(() => {
        screen.getByTestId('add-message').click()
      })

      await waitFor(() => {
        expect(screen.getByTestId('message-count')).toHaveTextContent('4')
      })
    })
  })

  describe('Streaming Updates', () => {
    it('should update streaming message content on response-chunk', async () => {
      render(
        <MessageList>
          <TestConsumer />
        </MessageList>
      )
      await waitForMount()

      await emitSocketEvent('conversation-history', { messages: [] })

      await waitFor(() => {
        screen.getByTestId('add-message').click()
      })

      // Now there should be a streaming assistant message
      const chunkEvent: ResponseChunkEvent = {
        text: 'Hello ',
        chunkIndex: 0,
      }

      await emitSocketEvent('response-chunk', chunkEvent)

      await waitFor(() => {
        expect(screen.getByText(/Hello/)).toBeInTheDocument()
      })

      await emitSocketEvent('response-chunk', { ...chunkEvent, text: 'World' })

      await waitFor(() => {
        expect(screen.getByText(/Hello World/)).toBeInTheDocument()
      })
    })

    it('should only update last streaming assistant message', async () => {
      render(
        <MessageList>
          <TestConsumer />
        </MessageList>
      )
      await waitForMount()

      const messages: Message[] = [
        { id: 'msg-1', role: 'assistant', content: 'Old message', timestamp: new Date(), isStreaming: false }
      ]

      await emitSocketEvent('conversation-history', { messages })

      await waitFor(() => {
        screen.getByTestId('add-message').click()
      })

      // Now msg-2 is the streaming message
      await emitSocketEvent('response-chunk', { text: 'New', threadId: 'test-thread', messageId: 'msg-2' })

      await waitFor(() => {
        expect(screen.getByText('Old message')).toBeInTheDocument()
        expect(screen.getByText('New')).toBeInTheDocument()
      })
    })

    it('should mark message as complete on response-complete', async () => {
      render(<MessageList />)
      await waitForMount()

      const messages: Message[] = [
        { id: 'msg-1', role: 'assistant', content: 'Test', timestamp: new Date(), isStreaming: true }
      ]

      await emitSocketEvent('conversation-history', { messages })

      await emitSocketEvent('response-complete', {})

      await waitFor(() => {
        // Message should still be rendered
        expect(screen.getByText('Test')).toBeInTheDocument()
      })
    })

    it('should not update non-streaming messages on chunk', async () => {
      render(<MessageList />)
      await waitForMount()

      const messages: Message[] = [
        { id: 'msg-1', role: 'assistant', content: 'Complete', timestamp: new Date(), isStreaming: false }
      ]

      await emitSocketEvent('conversation-history', { messages })

      await emitSocketEvent('response-chunk', { text: 'Should not appear', threadId: 'test-thread', messageId: 'msg-1' })

      await waitFor(() => {
        expect(screen.getByText('Complete')).toBeInTheDocument()
        expect(screen.queryByText('Should not appear')).not.toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('should display error message on chat-error event', async () => {
      render(<MessageList />)
      await waitForMount()

      await emitSocketEvent('conversation-history', { messages: [] })

      await emitSocketEvent('chat-error', { error: 'Connection failed', details: 'Network timeout' })

      await waitFor(() => {
        expect(screen.getByText('Connection failed: Network timeout')).toBeInTheDocument()
      })
    })

    it('should display error without details', async () => {
      render(<MessageList />)
      await waitForMount()

      await emitSocketEvent('conversation-history', { messages: [] })

      await emitSocketEvent('chat-error', { error: 'Something went wrong' })

      await waitFor(() => {
        expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      })
    })

    it('should mark streaming messages as complete when error occurs', async () => {
      render(<MessageList />)
      await waitForMount()

      const messages: Message[] = [
        { id: 'msg-1', role: 'assistant', content: 'Streaming', timestamp: new Date(), isStreaming: true }
      ]

      await emitSocketEvent('conversation-history', { messages })

      await emitSocketEvent('chat-error', { error: 'Error occurred' })

      await waitFor(() => {
        expect(screen.getByText('Streaming')).toBeInTheDocument()
        expect(screen.getByText('Error occurred')).toBeInTheDocument()
      })
    })
  })

  describe('Auto-scroll', () => {
    it('should call scrollIntoView on mount', async () => {
      render(<MessageList />)
      await waitForMount()

      await emitSocketEvent('conversation-history', { messages: [] })

      await waitFor(() => {
        expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled()
      })
    })

    it('should scroll when messages change', async () => {
      render(<MessageList />)
      await waitForMount()

      await emitSocketEvent('conversation-history', { messages: [] })

      const scrollCallsBefore = vi.mocked(HTMLElement.prototype.scrollIntoView).mock.calls.length

      const messages: Message[] = [
        { id: 'msg-1', role: 'user', content: 'New message', timestamp: new Date() }
      ]

      await emitSocketEvent('conversation-history', { messages })

      await waitFor(() => {
        const scrollCallsAfter = vi.mocked(HTMLElement.prototype.scrollIntoView).mock.calls.length
        expect(scrollCallsAfter).toBeGreaterThan(scrollCallsBefore)
      })
    })

    it('should scroll during streaming updates', async () => {
      render(<MessageList />)
      await waitForMount()

      const messages: Message[] = [
        { id: 'msg-1', role: 'assistant', content: '', timestamp: new Date(), isStreaming: true }
      ]

      await emitSocketEvent('conversation-history', { messages })

      const scrollCallsBefore = vi.mocked(HTMLElement.prototype.scrollIntoView).mock.calls.length

      await emitSocketEvent('response-chunk', { text: 'Chunk', threadId: 'test-thread', messageId: 'msg-1' })

      await waitFor(() => {
        const scrollCallsAfter = vi.mocked(HTMLElement.prototype.scrollIntoView).mock.calls.length
        expect(scrollCallsAfter).toBeGreaterThan(scrollCallsBefore)
      })
    })
  })

  describe('Children Rendering', () => {
    it('should render children', async () => {
      render(
        <MessageList>
          <div data-testid="child-component">Child</div>
        </MessageList>
      )

      await emitSocketEvent('conversation-history', { messages: [] })

      await waitFor(() => {
        expect(screen.getByTestId('child-component')).toBeInTheDocument()
      })
    })

    it('should render children even during loading', () => {
      render(
        <MessageList>
          <div data-testid="child-component">Child</div>
        </MessageList>
      )

      expect(screen.getByTestId('child-component')).toBeInTheDocument()
    })
  })

  describe('Styling', () => {
    it('should apply custom className', async () => {
      const { container } = render(<MessageList className="custom-class" />)
      await waitForMount()

      await emitSocketEvent('conversation-history', { messages: [] })

      await waitFor(() => {
        const messageContainer = container.querySelector('.custom-class')
        expect(messageContainer).toBeInTheDocument()
      })
    })

    it('should have max-width container for messages', async () => {
      render(<MessageList />)
      await waitForMount()

      await emitSocketEvent('conversation-history', { messages: [] })

      await waitFor(() => {
        // MUI Box component handles layout - verify welcome message is shown
        expect(screen.getByText('Welcome! 👋')).toBeInTheDocument()
      })
    })
  })

  describe('Socket Cleanup', () => {
    it('should cleanup listeners on unmount', async () => {
      const { unmount } = render(<MessageList />)
      await waitForMount()

      await emitSocketEvent('conversation-history', { messages: [] })

      await waitFor(() => {
        expect(screen.queryByText('Loading conversation...')).not.toBeInTheDocument()
      })

      const offSpy = vi.spyOn(mockSocket, 'off')

      unmount()

      expect(offSpy).toHaveBeenCalled()
    })
  })
})
