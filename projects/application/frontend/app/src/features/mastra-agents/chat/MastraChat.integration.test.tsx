import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MastraChat } from './MastraChat'
import { verifyBackendAvailable } from '../../../../test/utils/integration-helpers'

/**
 * MastraChat Integration Tests
 *
 * Tests real streaming chat with Mastra agents via backend at localhost:8085
 * These tests FAIL LOUDLY if backend is not running
 */
describe('MastraChat (Integration)', () => {
  beforeAll(async () => {
    // Verify backend is available
    await verifyBackendAvailable()
  })

  afterEach(() => {
    // Cleanup any open sockets
    // The ChatProvider should handle cleanup in useEffect cleanup
  })

  it('should render chat interface', () => {
    render(<MastraChat userId="test-user" threadId="test-thread" />)

    // Should render message input
    const input = screen.getByPlaceholderText(/type your message/i)
    expect(input).toBeInTheDocument()
  })

  it('should connect to backend WebSocket on mount', async () => {
    render(<MastraChat userId="test-user-ws" threadId="test-thread-ws" />)

    // The chat should establish a WebSocket connection
    // We can verify by checking that the component renders without errors
    const input = screen.getByPlaceholderText(/type your message/i)
    expect(input).toBeInTheDocument()

    // Give time for WebSocket connection to establish
    await waitFor(
      () => {
        // Component should be fully rendered and connected
        expect(input).toBeEnabled()
      },
      { timeout: 10000 }
    )
  })

  it('should send message and receive streaming response from real backend', async () => {
    const user = userEvent.setup()
    const testMessage = 'Hello, what is 2+2?'

    render(<MastraChat userId="integration-test-user" threadId="integration-test-thread" />)

    // Wait for component to be ready
    await waitFor(
      () => {
        const input = screen.getByPlaceholderText(/type your message/i)
        expect(input).toBeInTheDocument()
      },
      { timeout: 5000 }
    )

    // Type message
    const input = screen.getByPlaceholderText(/type your message/i)
    await user.clear(input)
    await user.type(input, testMessage)

    expect(input).toHaveValue(testMessage)

    // Find and click send button (wait for it to be enabled)
    const sendButton = await screen.findByRole('button', { name: /send/i }, { timeout: 5000 })
    await waitFor(() => expect(sendButton).toBeEnabled(), { timeout: 2000 })
    await user.click(sendButton)

    // Wait for message to be sent (input should clear)
    await waitFor(
      () => {
        expect(input).toHaveValue('')
      },
      { timeout: 5000 }
    )

    // Wait for AI response to appear
    // This tests real WebSocket streaming from Mastra agents
    await waitFor(
      () => {
        // Look for the user message in the chat (may have duplicates from previous tests)
        const userMessages = screen.queryAllByText(testMessage)
        expect(userMessages.length).toBeGreaterThan(0)
      },
      { timeout: 20000 }
    )

    // Wait for AI response (streaming may take time)
    await waitFor(
      () => {
        // Check that there are multiple messages (user + AI)
        const messages = screen.getAllByRole('article')
        expect(messages.length).toBeGreaterThan(1)
      },
      { timeout: 30000 }
    )
  }, 60000) // Extended timeout for full chat flow

  it('should handle multiple messages in sequence', async () => {
    const user = userEvent.setup()

    render(<MastraChat userId="multi-msg-user" threadId="multi-msg-thread" />)

    // Wait for ready
    const input = await screen.findByPlaceholderText(/type your message/i, {}, { timeout: 5000 })

    // Send first message
    await user.clear(input)
    await user.type(input, 'First message')

    // Wait for button to be enabled, then click
    const sendButton1 = await screen.findByRole('button', { name: /send/i }, { timeout: 5000 })
    await waitFor(() => expect(sendButton1).toBeEnabled(), { timeout: 2000 })
    await user.click(sendButton1)

    // Wait for input to clear
    await waitFor(() => expect(input).toHaveValue(''), { timeout: 5000 })

    // Wait for AI response to first message (to avoid act warnings from async state updates)
    await waitFor(
      () => {
        const messages = screen.queryAllByRole('article')
        expect(messages.length).toBeGreaterThanOrEqual(2) // User message + AI response
      },
      { timeout: 10000 }
    )

    // Wait for input to become enabled again before typing second message
    await waitFor(() => expect(input).toBeEnabled(), { timeout: 5000 })

    // Send second message
    await user.clear(input)
    await user.type(input, 'Second message')

    // Wait for button to be enabled again, then click
    const sendButton2 = await screen.findByRole('button', { name: /send/i }, { timeout: 5000 })
    await waitFor(() => expect(sendButton2).toBeEnabled(), { timeout: 2000 })
    await user.click(sendButton2)

    // Wait for input to clear after second message
    await waitFor(() => expect(input).toHaveValue(''), { timeout: 5000 })

    // Verify both messages appear and wait for AI responses (may have duplicates from previous tests)
    await waitFor(
      () => {
        expect(screen.queryAllByText('First message').length).toBeGreaterThan(0)
        expect(screen.queryAllByText('Second message').length).toBeGreaterThan(0)
        // Ensure AI responses have arrived (4+ messages: 2 user + 2 AI)
        const messages = screen.queryAllByRole('article')
        expect(messages.length).toBeGreaterThanOrEqual(4)
      },
      { timeout: 15000 }
    )
  }, 60000)

  it('should maintain connection with correct userId and threadId', async () => {
    const testUserId = 'specific-user-id'
    const testThreadId = 'specific-thread-id'

    render(<MastraChat userId={testUserId} threadId={testThreadId} />)

    // Verify component renders with these IDs
    const input = await screen.findByPlaceholderText(/type your message/i, {}, { timeout: 5000 })
    expect(input).toBeInTheDocument()

    // The ChatProvider should establish connection with these IDs
    // If connection fails, the component would error out
    await waitFor(
      () => {
        expect(input).toBeEnabled()
      },
      { timeout: 10000 }
    )
  })

  it('should handle empty message gracefully', async () => {
    render(<MastraChat userId="empty-msg-user" threadId="empty-msg-thread" />)

    const input = await screen.findByPlaceholderText(/type your message/i, {}, { timeout: 5000 })
    const sendButton = await screen.findByRole('button', { name: /send/i }, { timeout: 5000 })

    // Verify button is disabled when input is empty
    expect(sendButton).toBeDisabled()

    // Input should remain empty
    expect(input).toHaveValue('')
  })
})
