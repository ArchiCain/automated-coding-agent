import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MessageInput } from './MessageInput'
import { createMockSocket } from '../../../../../test/utils/mock-providers'

// Mock dependencies
const mockSocket = createMockSocket()
const mockAddUserMessage = vi.fn()

vi.mock('../ChatProvider', () => ({
  useChatContext: () => ({
    socket: mockSocket,
    isConnected: true,
    userId: 'test-user',
    threadId: 'test-thread'
  })
}))

vi.mock('../message-list/MessageList', () => ({
  useMessageList: () => ({
    addUserMessage: mockAddUserMessage,
    messages: []
  })
}))

vi.mock('./message-input.service', () => ({
  messageInputService: {
    sendMessage: vi.fn()
  }
}))

describe('MessageInput (Unit)', () => {
  let messageInputService: any

  beforeEach(async () => {
    // Import the mocked module
    const module = await import('./message-input.service')
    messageInputService = module.messageInputService

    vi.clearAllMocks()
  })

  it('should render textarea with placeholder', () => {
    render(<MessageInput placeholder="Type here..." />)

    const textarea = screen.getByPlaceholderText('Type here...')
    expect(textarea).toBeInTheDocument()
  })

  it('should render send button', () => {
    render(<MessageInput />)

    const sendButton = screen.getByRole('button')
    expect(sendButton).toBeInTheDocument()
  })

  it('should update message state when typing', async () => {
    const user = userEvent.setup()
    render(<MessageInput />)

    const textarea = screen.getByPlaceholderText('Type your message...')
    await user.type(textarea, 'Hello')

    expect(textarea).toHaveValue('Hello')
  })

  it('should be disabled when disabled prop is true', () => {
    render(<MessageInput disabled={true} />)

    const textarea = screen.getByPlaceholderText('Type your message...')
    expect(textarea).toBeDisabled()
  })

  it('should disable send button when message is empty', () => {
    render(<MessageInput />)

    const sendButton = screen.getByRole('button')
    expect(sendButton).toBeDisabled()
  })

  it('should enable send button when message has content', async () => {
    const user = userEvent.setup()
    render(<MessageInput />)

    const textarea = screen.getByPlaceholderText('Type your message...')
    const sendButton = screen.getByRole('button')

    await user.type(textarea, 'Hello')

    await waitFor(() => {
      expect(sendButton).not.toBeDisabled()
    })
  })

  it('should send message when send button is clicked', async () => {
    const user = userEvent.setup()

    render(<MessageInput />)

    const textarea = screen.getByPlaceholderText('Type your message...')
    const sendButton = screen.getByRole('button')

    await user.type(textarea, 'Test message')
    await user.click(sendButton)

    await waitFor(() => {
      expect(mockAddUserMessage).toHaveBeenCalledWith('Test message')
      expect(messageInputService.sendMessage).toHaveBeenCalledWith(mockSocket, 'Test message')
    })
  })

  it('should clear message input after sending', async () => {
    const user = userEvent.setup()
    render(<MessageInput />)

    const textarea = screen.getByPlaceholderText('Type your message...')
    const sendButton = screen.getByRole('button')

    await user.type(textarea, 'Test message')
    await user.click(sendButton)

    await waitFor(() => {
      expect(textarea).toHaveValue('')
    })
  })

  it('should trim whitespace from message before sending', async () => {
    const user = userEvent.setup()

    render(<MessageInput />)

    const textarea = screen.getByPlaceholderText('Type your message...')
    const sendButton = screen.getByRole('button')

    await user.type(textarea, '  Test message  ')
    await user.click(sendButton)

    await waitFor(() => {
      expect(messageInputService.sendMessage).toHaveBeenCalledWith(mockSocket, 'Test message')
    })
  })

  it('should not send empty or whitespace-only messages', async () => {
    const user = userEvent.setup()

    render(<MessageInput />)

    const textarea = screen.getByPlaceholderText('Type your message...')
    const sendButton = screen.getByRole('button')

    await user.type(textarea, '   ')

    // Button should be disabled for whitespace-only messages
    expect(sendButton).toBeDisabled()
    expect(messageInputService.sendMessage).not.toHaveBeenCalled()
  })

  it('should apply custom className', () => {
    const { container } = render(<MessageInput className="custom-class" />)

    const inputContainer = container.querySelector('.custom-class')
    expect(inputContainer).toBeInTheDocument()
  })

  it('should handle send errors gracefully', async () => {
    const user = userEvent.setup()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    messageInputService.sendMessage.mockRejectedValue(new Error('Send failed'))

    render(<MessageInput />)

    const textarea = screen.getByPlaceholderText('Type your message...')
    const sendButton = screen.getByRole('button')

    await user.type(textarea, 'Test message')
    await user.click(sendButton)

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalled()
    })

    consoleError.mockRestore()
  })
})
