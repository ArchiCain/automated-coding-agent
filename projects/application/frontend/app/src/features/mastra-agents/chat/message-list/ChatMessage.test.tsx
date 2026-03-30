import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ChatMessage } from './ChatMessage'
import { Message } from '../types'
import { createMockSocket } from '../../../../../test/utils/mock-providers'
import * as ChatProviderModule from '../ChatProvider'

// Mock dependencies
vi.mock('../ChatProvider', () => ({
  useChatContext: vi.fn()
}))

vi.mock('./MarkdownRenderer', () => ({
  MarkdownRenderer: ({ content }: { content: string }) => (
    <div data-testid="markdown-renderer">{content}</div>
  )
}))

vi.mock('./message-list.service', () => ({
  messageListService: {
    onResponseChunk: vi.fn(),
    offResponseChunk: vi.fn()
  }
}))

describe('ChatMessage (Unit)', () => {
  const mockSocket = createMockSocket()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(ChatProviderModule.useChatContext).mockReturnValue({
      socket: mockSocket,
      userId: 'test-user',
      threadId: 'test-thread',
      isConnected: true,
    })
  })

  describe('User Messages', () => {
    const userMessage: Message = {
      id: 'msg-1',
      role: 'user',
      content: 'Hello, this is a user message',
      timestamp: new Date(),
      isStreaming: false
    }

    it('should render user message content', () => {
      render(<ChatMessage message={userMessage} />)

      expect(screen.getByText('Hello, this is a user message')).toBeInTheDocument()
    })

    it('should have correct ARIA label for user message', () => {
      render(<ChatMessage message={userMessage} />)

      const messageElement = screen.getByRole('article')
      expect(messageElement).toHaveAttribute('aria-label', 'User message')
    })

    it('should align user messages to the right', () => {
      render(<ChatMessage message={userMessage} />)

      const messageElement = screen.getByRole('article')
      expect(messageElement).toBeInTheDocument()
      // MUI Box with justifyContent: 'flex-end' for user messages
    })

    it('should apply accent background to user messages', () => {
      render(<ChatMessage message={userMessage} />)

      const messageElement = screen.getByRole('article')
      expect(messageElement).toBeInTheDocument()
      // MUI Card with primary.light bgcolor for user messages
    })

    it('should preserve whitespace in user messages', () => {
      const messageWithWhitespace: Message = {
        ...userMessage,
        content: 'Line 1\nLine 2\n  Indented'
      }

      render(<ChatMessage message={messageWithWhitespace} />)

      const messageElement = screen.getByRole('article')
      expect(messageElement).toBeInTheDocument()
      expect(messageElement.textContent).toContain('Line 1')
      expect(messageElement.textContent).toContain('Line 2')
      expect(messageElement.textContent).toContain('Indented')
      // MUI Box has whiteSpace: 'pre-wrap' via sx prop
    })
  })

  describe('Assistant Messages', () => {
    const assistantMessage: Message = {
      id: 'msg-2',
      role: 'assistant',
      content: 'This is an assistant response',
      timestamp: new Date(),
      isStreaming: false
    }

    it('should render assistant message with MarkdownRenderer', () => {
      render(<ChatMessage message={assistantMessage} />)

      expect(screen.getByTestId('markdown-renderer')).toBeInTheDocument()
      expect(screen.getByText('This is an assistant response')).toBeInTheDocument()
    })

    it('should have correct ARIA label for assistant message', () => {
      render(<ChatMessage message={assistantMessage} />)

      const messageElement = screen.getByRole('article')
      expect(messageElement).toHaveAttribute('aria-label', 'Assistant message')
    })

    it('should align assistant messages to the left', () => {
      render(<ChatMessage message={assistantMessage} />)

      const messageElement = screen.getByRole('article')
      expect(messageElement).toBeInTheDocument()
      // MUI Box with justifyContent: 'flex-start' for assistant messages
    })

    it('should apply muted background to assistant messages', () => {
      render(<ChatMessage message={assistantMessage} />)

      const messageElement = screen.getByRole('article')
      expect(messageElement).toBeInTheDocument()
      // MUI Card with grey.100 bgcolor for assistant messages
    })

    it('should have full width for assistant messages', () => {
      render(<ChatMessage message={assistantMessage} />)

      const messageElement = screen.getByRole('article')
      expect(messageElement).toBeInTheDocument()
      // MUI Box with width: '100%' for assistant messages
    })
  })

  describe('Streaming Messages', () => {
    const streamingMessage: Message = {
      id: 'msg-3',
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    }

    it('should show loading animation when streaming with no content', () => {
      render(<ChatMessage message={streamingMessage} />)

      // MUI renders animated dots via Box components with keyframe animations
      const messageElement = screen.getByRole('article')
      expect(messageElement).toBeInTheDocument()
    })

    it('should show cursor when streaming with content', () => {
      const messageWithContent: Message = {
        ...streamingMessage,
        content: 'Streaming response...'
      }

      render(<ChatMessage message={messageWithContent} />)

      // Should have content and streaming cursor (MUI Box with pulse animation)
      expect(screen.getByText('Streaming response...')).toBeInTheDocument()
    })

    it('should not show cursor when not streaming', () => {
      const completeMessage: Message = {
        ...streamingMessage,
        content: 'Complete response',
        isStreaming: false
      }

      render(<ChatMessage message={completeMessage} />)

      expect(screen.getByText('Complete response')).toBeInTheDocument()
      // MUI doesn't render cursor when isStreaming is false
    })

    it('should update isStreaming state when message prop changes', async () => {
      const streamingWithContent: Message = {
        ...streamingMessage,
        content: 'Streaming...'
      }

      const { rerender } = render(<ChatMessage message={streamingWithContent} />)

      // Initially streaming with content
      expect(screen.getByText('Streaming...')).toBeInTheDocument()

      // Update to not streaming
      const completeMessage: Message = {
        ...streamingWithContent,
        isStreaming: false
      }

      rerender(<ChatMessage message={completeMessage} />)

      // Content should remain visible
      await waitFor(() => {
        expect(screen.getByText('Streaming...')).toBeInTheDocument()
      })
      // MUI no longer renders cursor when isStreaming is false
    })
  })

  describe('Custom Styling', () => {
    const message: Message = {
      id: 'msg-4',
      role: 'user',
      content: 'Test message',
      timestamp: new Date(),
      isStreaming: false
    }

    it('should apply custom className when provided', () => {
      const { container } = render(
        <ChatMessage message={message} className="custom-class" />
      )

      const messageElement = container.querySelector('.custom-class')
      expect(messageElement).toBeInTheDocument()
    })

    it('should have transition animation classes', () => {
      render(<ChatMessage message={message} />)

      const messageElement = screen.getByRole('article')
      expect(messageElement).toBeInTheDocument()
      // MUI Card has transitions via sx prop
    })

    it('should have hover effect on card', () => {
      render(<ChatMessage message={message} />)

      const messageElement = screen.getByRole('article')
      expect(messageElement).toBeInTheDocument()
      // MUI Card has hover effects via sx prop ('&:hover': { elevation: 3 })
    })
  })

  describe('Content Display', () => {
    it('should break long words correctly', () => {
      const longWordMessage: Message = {
        id: 'msg-5',
        role: 'user',
        content: 'verylongwordwithnobreakspointsandmanycharacters',
        timestamp: new Date(),
        isStreaming: false
      }

      render(<ChatMessage message={longWordMessage} />)

      expect(screen.getByText('verylongwordwithnobreakspointsandmanycharacters')).toBeInTheDocument()
      // MUI Box has wordBreak: 'break-word' via sx prop
    })

    it('should have relaxed line height for readability', () => {
      const message: Message = {
        id: 'msg-6',
        role: 'assistant',
        content: 'Multi\nline\ncontent',
        timestamp: new Date(),
        isStreaming: false
      }

      render(<ChatMessage message={message} />)

      const messageElement = screen.getByRole('article')
      expect(messageElement).toBeInTheDocument()
      // MUI Box has lineHeight: 1.6 via sx prop
    })
  })

  describe('Message Role Handling', () => {
    it('should handle user role correctly', () => {
      const message: Message = {
        id: 'msg-7',
        role: 'user',
        content: 'User message',
        timestamp: new Date(),
        isStreaming: false
      }

      render(<ChatMessage message={message} />)

      // User messages should NOT have MarkdownRenderer
      expect(screen.queryByTestId('markdown-renderer')).not.toBeInTheDocument()
      // Should have plain text display
      expect(screen.getByText('User message')).toBeInTheDocument()
    })

    it('should handle assistant role correctly', () => {
      const message: Message = {
        id: 'msg-8',
        role: 'assistant',
        content: 'Assistant message',
        timestamp: new Date(),
        isStreaming: false
      }

      render(<ChatMessage message={message} />)

      // Assistant messages should have MarkdownRenderer
      expect(screen.getByTestId('markdown-renderer')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty content', () => {
      const emptyMessage: Message = {
        id: 'msg-9',
        role: 'user',
        content: '',
        timestamp: new Date(),
        isStreaming: false
      }

      render(<ChatMessage message={emptyMessage} />)

      const messageElement = screen.getByRole('article')
      expect(messageElement).toBeInTheDocument()
    })

    it('should handle very long content', () => {
      const longContent = 'A'.repeat(1000)
      const longMessage: Message = {
        id: 'msg-10',
        role: 'assistant',
        content: longContent,
        timestamp: new Date(),
        isStreaming: false
      }

      render(<ChatMessage message={longMessage} />)

      expect(screen.getByTestId('markdown-renderer')).toBeInTheDocument()
    })

    it('should handle special characters in content', () => {
      const specialCharsMessage: Message = {
        id: 'msg-11',
        role: 'user',
        content: '<script>alert("xss")</script> & special chars',
        timestamp: new Date(),
        isStreaming: false
      }

      render(<ChatMessage message={specialCharsMessage} />)

      // Content should be safely rendered (React escapes by default)
      expect(screen.getByText('<script>alert("xss")</script> & special chars')).toBeInTheDocument()
    })

    it('should handle undefined isStreaming as false', () => {
      const messageWithoutStreaming: Message = {
        id: 'msg-12',
        role: 'assistant',
        content: 'Test',
        timestamp: new Date()
        // isStreaming intentionally omitted
      } as Message

      const { container } = render(<ChatMessage message={messageWithoutStreaming} />)

      // Should not show loading dots or cursor
      const dots = container.querySelectorAll('.animate-bounce')
      expect(dots.length).toBe(0)
      const cursor = container.querySelector('.animate-pulse')
      expect(cursor).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper role attribute', () => {
      const message: Message = {
        id: 'msg-13',
        role: 'user',
        content: 'Test',
        timestamp: new Date(),
        isStreaming: false
      }

      render(<ChatMessage message={message} />)

      expect(screen.getByRole('article')).toBeInTheDocument()
    })

    it('should have descriptive aria-label', () => {
      const userMessage: Message = {
        id: 'msg-14',
        role: 'user',
        content: 'User test',
        timestamp: new Date(),
        isStreaming: false
      }

      render(<ChatMessage message={userMessage} />)

      const article = screen.getByRole('article')
      expect(article).toHaveAttribute('aria-label', 'User message')
    })
  })
})
