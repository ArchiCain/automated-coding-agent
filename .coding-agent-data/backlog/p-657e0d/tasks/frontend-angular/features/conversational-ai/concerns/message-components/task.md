---
id: t-d7b3c4
parent: t-c8a5f1
created: 2026-01-26T17:46:00.000Z
updated: 2026-01-26T17:46:00.000Z
---

# Task: Message Display Components

## Purpose
Create Angular components for displaying chat messages, input field, and markdown rendering including user messages, AI responses, streaming indicators, and markdown code block syntax highlighting.

## Context

### Conventions
Follow Angular component patterns with ngx-markdown integration:
- Use standalone components for message display and input
- Implement markdown rendering with syntax highlighting using ngx-markdown
- Use reactive forms for message input with validation
- Handle streaming message updates with smooth UX
- Reference: `projects/coding-agent-frontend/app/src/app/features/claude-code-agent/components/transcript-renderer/transcript-renderer.ts`

### Interfaces
```typescript
interface MessageDisplayComponent {
  message: MastraChatMessage;
  isStreaming: boolean;
}

interface MessageInputComponent {
  onSendMessage: (content: string) => void;
  isDisabled: boolean;
  isLoading: boolean;
}

interface MarkdownRendererOptions {
  enableSyntaxHighlight: boolean;
  enableCodeCopy: boolean;
}
```

### Boundaries
- **Exposes**: Reusable message display and input components
- **Consumes**: ngx-markdown for rendering, reactive forms for input
- **Constraints**: Must support markdown rendering, code syntax highlighting, and streaming message updates

### References
- `projects/frontend/app/src/features/mastra-agents/chat/message-list/ChatMessage.tsx` - Message display patterns
- `projects/frontend/app/src/features/mastra-agents/chat/message-input/MessageInput.tsx` - Input component structure
- `projects/frontend/app/src/features/mastra-agents/chat/message-list/MarkdownRenderer.tsx` - Markdown rendering implementation
- `projects/coding-agent-frontend/app/package.json` - ngx-markdown v21.0.1 and marked v17.0.1 dependencies

## Specification

### Requirements
- Create message display component for user and AI messages
- Implement message input component with send functionality
- Add markdown rendering with syntax highlighting
- Support streaming message display with typing animation
- Create code block component with copy functionality
- Handle message timestamps and user avatars
- Implement responsive message layout
- Add loading states for message sending
- Support Enter key for message sending
- Handle multi-line input with Shift+Enter

### Files
- `src/features/conversational-ai/components/message-display.component.ts` - Individual message display
- `src/features/conversational-ai/components/message-display.component.html` - Message template
- `src/features/conversational-ai/components/message-display.component.scss` - Message styles
- `src/features/conversational-ai/components/message-input.component.ts` - Input field component
- `src/features/conversational-ai/components/message-input.component.html` - Input template
- `src/features/conversational-ai/components/message-input.component.scss` - Input styles
- `src/features/conversational-ai/components/markdown-renderer.component.ts` - Markdown display component

### Acceptance Criteria
- [ ] Message display component shows user and AI messages distinctly
- [ ] Markdown rendering with syntax highlighting for code blocks
- [ ] Code blocks include copy-to-clipboard functionality
- [ ] Streaming messages show typing animation
- [ ] Message input supports Enter to send, Shift+Enter for new line
- [ ] Input validation and loading states
- [ ] Responsive message layout for mobile and desktop
- [ ] User avatars and timestamps display correctly
- [ ] Message list auto-scrolls to new messages
- [ ] Support for long messages with appropriate wrapping