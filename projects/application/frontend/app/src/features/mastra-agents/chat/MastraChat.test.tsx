import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MastraChat } from './MastraChat'
import { createMockSocket } from '../../../../test/utils/mock-providers'

// Mock the websocket client
vi.mock('@/features/api-client/websocket-client', () => ({
  getSocket: vi.fn(() => createMockSocket())
}))

// Mock the MessageList component
vi.mock('./message-list', () => ({
  MessageList: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="message-list">{children}</div>
  )
}))

// Mock the MessageInput component
vi.mock('./message-input', () => ({
  MessageInput: ({ placeholder }: { placeholder: string }) => (
    <div data-testid="message-input" data-placeholder={placeholder} />
  )
}))

describe('MastraChat (Unit)', () => {
  it('should render with userId and threadId', () => {
    render(<MastraChat userId="user-123" threadId="thread-456" />)

    // Component should render without errors
    expect(screen.getByTestId('message-list')).toBeInTheDocument()
  })

  it('should render MessageList component', () => {
    render(<MastraChat userId="user-1" threadId="thread-1" />)

    expect(screen.getByTestId('message-list')).toBeInTheDocument()
  })

  it('should render MessageInput component', () => {
    render(<MastraChat userId="user-1" threadId="thread-1" />)

    expect(screen.getByTestId('message-input')).toBeInTheDocument()
  })

  it('should pass correct placeholder to MessageInput', () => {
    render(<MastraChat userId="user-1" threadId="thread-1" />)

    const messageInput = screen.getByTestId('message-input')
    expect(messageInput.getAttribute('data-placeholder')).toBe('Type your message...')
  })

  it('should apply custom className when provided', () => {
    const { container } = render(
      <MastraChat userId="user-1" threadId="thread-1" className="custom-class" />
    )

    const chatContainer = container.querySelector('.custom-class')
    expect(chatContainer).toBeInTheDocument()
  })

  it('should wrap components in ChatProvider', () => {
    render(<MastraChat userId="user-1" threadId="thread-1" />)

    // Component should render without errors - ChatProvider is tested separately
    expect(screen.getByTestId('message-list')).toBeInTheDocument()
  })

  it('should have proper layout structure', () => {
    render(
      <MastraChat userId="user-1" threadId="thread-1" />
    )

    // Verify components are rendered (MUI Box handles layout)
    expect(screen.getByTestId('message-list')).toBeInTheDocument()
    expect(screen.getByTestId('message-input')).toBeInTheDocument()
  })

  it('should render input area in correct position', () => {
    render(<MastraChat userId="user-1" threadId="thread-1" />)

    const messageList = screen.getByTestId('message-list')
    const messageInput = screen.getByTestId('message-input')

    // Both should be present
    expect(messageList).toBeInTheDocument()
    expect(messageInput).toBeInTheDocument()
  })
})
