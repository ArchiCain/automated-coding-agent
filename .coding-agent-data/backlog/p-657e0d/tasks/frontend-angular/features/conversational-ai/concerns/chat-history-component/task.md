---
id: t-c9d2f5
parent: t-c8a5f1
created: 2026-01-26T17:46:00.000Z
updated: 2026-01-26T17:46:00.000Z
---

# Task: Chat History Sidebar Component

## Purpose
Create an Angular component that displays conversation history in a sidebar, supports thread selection, new conversation creation, and mobile drawer functionality.

## Context

### Conventions
Follow Angular component patterns established in the codebase:
- Use standalone component with Material Design components
- Implement responsive design with drawer for mobile
- Use signal-based state management for thread list
- Handle loading states and empty states gracefully
- Reference: `projects/coding-agent-frontend/app/src/app/features/claude-code-agent/components/transcript-renderer/transcript-renderer.ts`

### Interfaces
```typescript
interface ChatHistoryComponent {
  activeThreadId: string;
  userId: string;
  onSelectConversation: (threadId: string) => void;
  onNewConversation: () => void;
}

interface ConversationListItem {
  threadId: string;
  title: string;
  lastMessage: string;
  updatedAt: Date;
  isActive: boolean;
}
```

### Boundaries
- **Exposes**: Sidebar component for thread history and navigation
- **Consumes**: Chat history service for thread list data, WebSocket service for real-time updates
- **Constraints**: Must support mobile drawer pattern, handle empty state, integrate with parent layout

### References
- `projects/frontend/app/src/features/mastra-agents/chat-history/` - React implementation for conversation history
- `projects/frontend/app/src/features/mastra-agents/MastraChatWithSidebar.tsx` - Sidebar layout patterns and mobile drawer
- `projects/coding-agent-frontend/app/src/app/features/claude-code-agent/components/` - Angular component patterns

## Specification

### Requirements
- Create standalone Angular component for conversation history
- Display list of conversation threads with titles and timestamps
- Support active thread highlighting
- Implement "New Conversation" button functionality
- Handle empty state when no conversations exist
- Support thread selection via click handlers
- Use Material Design list components and styling
- Implement loading states for thread fetching
- Support responsive design for mobile and desktop

### Files
- `src/features/conversational-ai/components/chat-history.component.ts` - Main component
- `src/features/conversational-ai/components/chat-history.component.html` - Template
- `src/features/conversational-ai/components/chat-history.component.scss` - Styles

### Acceptance Criteria
- [ ] Component displays list of conversation threads
- [ ] Highlights currently active thread
- [ ] Shows thread titles and last update timestamps
- [ ] Provides "New Conversation" button
- [ ] Handles empty state with appropriate messaging
- [ ] Emits events for thread selection and new conversation
- [ ] Uses Material Design list components
- [ ] Supports responsive design patterns
- [ ] Shows loading states during data fetching
- [ ] Truncates long thread titles appropriately