---
id: t-b4c7d8
parent: t-c8a5f1
created: 2026-01-26T17:46:00.000Z
updated: 2026-01-26T17:46:00.000Z
---

# Task: Mastra Chat WebSocket Service

## Purpose
Create an Angular service that manages WebSocket connections to Mastra chat namespaces, handles real-time messaging events, and provides observables for chat functionality.

## Context

### Conventions
Follow Angular service patterns established in the codebase:
- Use `@Injectable({ providedIn: 'root' })` for singleton services
- Use Socket.io client v4.8.x for WebSocket connections
- Implement event observables using Subject/Observable patterns
- Handle connection state management and reconnection logic
- Reference: `projects/coding-agent-frontend/app/src/app/features/claude-code-agent/services/session-websocket.service.ts` (lines 30-114)

### Interfaces
```typescript
interface MastraChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  threadId: string;
}

interface ChatSocketEvents {
  'user-message': (message: { content: string; threadId: string }) => void;
  'ai-response-chunk': (chunk: { content: string; threadId: string }) => void;
  'ai-response-complete': (data: { threadId: string }) => void;
}

interface ChatServiceInterface {
  connect(): void;
  disconnect(): void;
  sendMessage(content: string, threadId: string): void;
  subscribeToThread(threadId: string): void;
  generateThreadId(): string;
}
```

### Boundaries
- **Exposes**: WebSocket service with observables for message events and connection state
- **Consumes**: Backend WebSocket namespaces `/mastra-chat` and `/mastra-chat-history`
- **Constraints**: Must integrate with existing Socket.io infrastructure, handle reconnection scenarios, support streaming responses

### References
- `projects/coding-agent-frontend/app/src/app/features/claude-code-agent/services/session-websocket.service.ts` - WebSocket service pattern and event handling
- `projects/frontend/app/src/features/mastra-agents/chat/ChatProvider.tsx` - WebSocket connection logic and context
- `projects/coding-agent-frontend/app/package.json` - Socket.io client version (4.8.3)

## Specification

### Requirements
- Implement Angular injectable service using Socket.io client
- Connect to `/mastra-chat` namespace with user and thread context
- Provide observables for message events (chunks, completion, errors)
- Handle streaming AI responses with chunked updates
- Support thread subscription and unsubscription
- Implement connection state management
- Generate unique thread IDs using crypto or UUID
- Handle WebSocket reconnection scenarios gracefully

### Files
- `src/features/conversational-ai/services/mastra-chat-websocket.service.ts` - Main WebSocket service
- `src/features/conversational-ai/services/mastra-chat.service.ts` - Business logic service for chat operations

### Acceptance Criteria
- [ ] Service connects to `/mastra-chat` namespace
- [ ] Provides observables for all chat events
- [ ] Handles streaming responses with chunk accumulation
- [ ] Supports thread management (subscribe/unsubscribe)
- [ ] Implements connection state tracking
- [ ] Generates unique thread IDs
- [ ] Handles WebSocket errors gracefully
- [ ] Supports reconnection with state preservation
- [ ] Follows Angular dependency injection patterns