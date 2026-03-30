---
id: t-e1a5b9
parent: t-c8a5f1
created: 2026-01-26T17:46:00.000Z
updated: 2026-01-26T17:46:00.000Z
---

# Task: Chat Models and Types

## Purpose
Define TypeScript interfaces, types, and models for the conversational AI chat feature including messages, threads, WebSocket events, and component state management.

## Context

### Conventions
Follow TypeScript interface patterns established in the codebase:
- Use descriptive interface names with clear purpose
- Define event interfaces for WebSocket communication
- Create enum types for message roles and statuses
- Include JSDoc comments for complex interfaces
- Reference: `projects/coding-agent-frontend/app/src/app/features/claude-code-agent/models/agent.model.ts`

### Interfaces
```typescript
// Core chat entities
interface MastraChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  threadId: string;
  isStreaming?: boolean;
}

interface ChatThread {
  id: string;
  title: string;
  lastMessage?: string;
  updatedAt: Date;
  messageCount?: number;
}

// WebSocket events
interface ChatSocketEvents {
  'user-message': (message: { content: string; threadId: string }) => void;
  'ai-response-chunk': (chunk: { content: string; threadId: string }) => void;
  'ai-response-complete': (data: { threadId: string }) => void;
}
```

### Boundaries
- **Exposes**: TypeScript interfaces for all chat-related data structures and events
- **Consumes**: No external dependencies, pure type definitions
- **Constraints**: Must align with existing backend API contracts and WebSocket event schemas

### References
- `projects/coding-agent-frontend/app/src/app/features/claude-code-agent/models/agent.model.ts` - Model structure patterns
- `projects/frontend/app/src/features/mastra-agents/chat/ChatProvider.tsx` - Interface definitions for chat context
- Task specification interfaces from parent feature description

## Specification

### Requirements
- Define core message and thread interfaces
- Create WebSocket event type definitions
- Define component state interfaces for chat UI
- Include streaming message support interfaces
- Create error and loading state types
- Define service method interfaces
- Add JSDoc documentation for complex types

### Files
- `src/features/conversational-ai/models/chat.models.ts` - Core chat entity interfaces
- `src/features/conversational-ai/models/websocket.models.ts` - WebSocket event type definitions
- `src/features/conversational-ai/models/index.ts` - Barrel export file

### Acceptance Criteria
- [ ] MastraChatMessage interface supports all message properties
- [ ] ChatThread interface includes metadata for history display
- [ ] WebSocket event interfaces match backend contract
- [ ] Component state interfaces support loading and error states
- [ ] Service interfaces define all public methods
- [ ] Streaming message support with chunk accumulation
- [ ] Proper TypeScript typing with no `any` types
- [ ] JSDoc documentation for complex interfaces
- [ ] Barrel exports for clean imports