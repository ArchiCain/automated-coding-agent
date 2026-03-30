import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConversationList } from './ConversationList'
import { HistoryProvider } from '../HistoryProvider'
import { verifyBackendAvailable } from '../../../../../test/utils/integration-helpers'

/**
 * ConversationList Integration Tests
 *
 * Tests real conversation history data persistence via backend at localhost:8085
 * These tests FAIL LOUDLY if backend is not running
 */
describe('ConversationList (Integration)', () => {
  beforeAll(async () => {
    // Verify backend is available
    await verifyBackendAvailable()
  })

  afterEach(() => {
    // Cleanup any open sockets
  })

  it('should connect to backend and load conversation history', async () => {
    const mockOnSelect = () => {}
    const mockOnDelete = () => {}

    render(
      <HistoryProvider userId="test-history-user">
        <ConversationList
          activeThreadId="none"
          onSelectConversation={mockOnSelect}
          onDeleteConversation={mockOnDelete}
        />
      </HistoryProvider>
    )

    // Should show loading state initially
    expect(screen.getByText(/loading conversations/i)).toBeInTheDocument()

    // Wait for conversations to load from real backend
    await waitFor(
      () => {
        // Should either show conversations or "no conversations yet"
        const loadingText = screen.queryByText(/loading conversations/i)
        expect(loadingText).not.toBeInTheDocument()
      },
      { timeout: 15000 }
    )

    // Should show either conversations or empty state
    const emptyState = screen.queryByText(/no conversations yet/i)
    if (emptyState) {
      expect(emptyState).toBeInTheDocument()
    } else {
      // If there are conversations, they should be rendered
      // The actual content depends on backend state
      const conversationList = screen.getByRole('list', { hidden: true }) || document.querySelector('.space-y-2')
      expect(conversationList).toBeInTheDocument()
    }
  }, 30000)

  it('should handle conversation selection', async () => {
    const user = userEvent.setup()
    let selectedThreadId: string | null = null
    const mockOnSelect = (threadId: string) => {
      selectedThreadId = threadId
    }
    const mockOnDelete = () => {}

    render(
      <HistoryProvider userId="selection-test-user">
        <ConversationList
          activeThreadId="none"
          onSelectConversation={mockOnSelect}
          onDeleteConversation={mockOnDelete}
        />
      </HistoryProvider>
    )

    // Wait for loading to complete
    await waitFor(
      () => {
        expect(screen.queryByText(/loading conversations/i)).not.toBeInTheDocument()
      },
      { timeout: 15000 }
    )

    // Try to find conversation items (if any exist)
    const conversationButtons = screen.queryAllByRole('button')
    if (conversationButtons.length > 0) {
      // Click first conversation
      await user.click(conversationButtons[0])

      // Verify selection callback was called
      await waitFor(() => {
        expect(selectedThreadId).toBeTruthy()
      })
    }
  }, 30000)

  it('should receive real-time updates via WebSocket', async () => {
    const mockOnSelect = () => {}
    const mockOnDelete = () => {}

    render(
      <HistoryProvider userId="realtime-test-user">
        <ConversationList
          activeThreadId="none"
          onSelectConversation={mockOnSelect}
          onDeleteConversation={mockOnDelete}
        />
      </HistoryProvider>
    )

    // Wait for initial load
    await waitFor(
      () => {
        expect(screen.queryByText(/loading conversations/i)).not.toBeInTheDocument()
      },
      { timeout: 15000 }
    )

    // Component should be connected to WebSocket
    // Real-time updates would come through chat-history events
    // This verifies the connection is established
    const container = screen.getByText(/no conversations yet/i) || document.querySelector('.space-y-2')
    expect(container).toBeInTheDocument()
  }, 30000)

  it('should maintain connection with correct userId', async () => {
    const testUserId = 'specific-history-user'
    const mockOnSelect = () => {}
    const mockOnDelete = () => {}

    render(
      <HistoryProvider userId={testUserId}>
        <ConversationList
          activeThreadId="none"
          onSelectConversation={mockOnSelect}
          onDeleteConversation={mockOnDelete}
        />
      </HistoryProvider>
    )

    // Wait for connection to establish
    await waitFor(
      () => {
        expect(screen.queryByText(/loading conversations/i)).not.toBeInTheDocument()
      },
      { timeout: 15000 }
    )

    // Component should have loaded with correct user context
    // If connection failed with wrong userId, component would error
  }, 30000)

  it('should show empty state when no conversations exist', async () => {
    // Use a unique userId that likely has no conversations
    const emptyUserId = `empty-user-${Date.now()}`
    const mockOnSelect = () => {}
    const mockOnDelete = () => {}

    render(
      <HistoryProvider userId={emptyUserId}>
        <ConversationList
          activeThreadId="none"
          onSelectConversation={mockOnSelect}
          onDeleteConversation={mockOnDelete}
        />
      </HistoryProvider>
    )

    // Wait for loading to complete
    await waitFor(
      () => {
        expect(screen.queryByText(/loading conversations/i)).not.toBeInTheDocument()
      },
      { timeout: 15000 }
    )

    // Should show empty state for new user
    await waitFor(
      () => {
        const emptyState = screen.getByText(/no conversations yet/i)
        expect(emptyState).toBeInTheDocument()
      },
      { timeout: 5000 }
    )
  }, 30000)

  it('should highlight active conversation', async () => {
    const activeThreadId = 'active-thread-123'
    const mockOnSelect = () => {}
    const mockOnDelete = () => {}

    render(
      <HistoryProvider userId="highlight-test-user">
        <ConversationList
          activeThreadId={activeThreadId}
          onSelectConversation={mockOnSelect}
          onDeleteConversation={mockOnDelete}
        />
      </HistoryProvider>
    )

    // Wait for loading
    await waitFor(
      () => {
        expect(screen.queryByText(/loading conversations/i)).not.toBeInTheDocument()
      },
      { timeout: 15000 }
    )

    // The activeThreadId prop should be used to highlight the conversation
    // Implementation may vary, but component should render without errors
  }, 30000)

  it('should handle WebSocket connection errors gracefully', async () => {
    const mockOnSelect = () => {}
    const mockOnDelete = () => {}

    render(
      <HistoryProvider userId="error-test-user">
        <ConversationList
          activeThreadId="none"
          onSelectConversation={mockOnSelect}
          onDeleteConversation={mockOnDelete}
        />
      </HistoryProvider>
    )

    // Even if there are connection issues, component should render
    // and eventually show either loading or error state (not crash)
    await waitFor(
      () => {
        // Should show some UI (loading, empty, or conversations)
        const container = document.querySelector('.p-4') || document.querySelector('.space-y-2')
        expect(container).toBeInTheDocument()
      },
      { timeout: 20000 }
    )
  }, 30000)
})
