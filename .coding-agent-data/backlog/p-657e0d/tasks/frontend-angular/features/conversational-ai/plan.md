---
id: t-c8a5f1
parent: t-a9f3e2
created: 2026-01-26T17:46:00.000Z
updated: 2026-01-26T17:46:00.000Z
---

# Plan: Conversational AI Chat Feature

## Purpose
Implement the main conversational AI chat interface using WebSocket integration with Mastra agents, including real-time messaging, conversation history, thread management, and markdown rendering.

## Context

### Conventions
Follow Angular 21 patterns established in the codebase:
- **Standalone components** with no NgModules
- **Feature routing** via lazy-loaded routes in `conversational-ai.routes.ts`
- **Material Design** components with Azure/Blue theme
- **WebSocket service** using Socket.io client v4.8.x
- **Reactive forms** and RxJS observables for state management

Reference existing patterns:
- `projects/coding-agent-frontend/app/src/app/features/claude-code-agent/` - WebSocket integration
- `projects/frontend/app/src/features/mastra-agents/pages/ConversationalAI.tsx` - React implementation to port

### Interfaces
```typescript
// WebSocket connection interfaces
interface MastraChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  threadId: string;
}

interface ChatThread {
  id: string;
  title: string;
  lastMessage?: string;
  updatedAt: Date;
}

// Socket.io integration
interface ChatSocketEvents {
  'user-message': (message: { content: string; threadId: string }) => void;
  'ai-response-chunk': (chunk: { content: string; threadId: string }) => void;
  'ai-response-complete': (data: { threadId: string }) => void;
}

// Component interfaces
interface ChatPageComponent {
  userId: string;
  threadId: string;
  onThreadChange: (threadId: string) => void;
}
```

### Boundaries
- **Exposes**: Main chat interface at `/` route with sidebar navigation
- **Consumes**: Backend WebSocket namespaces `/mastra-chat` and `/mastra-chat-history`, user authentication
- **Constraints**:
  - Must integrate with existing Socket.io namespaces without backend changes
  - Must handle streaming responses with chunked message updates
  - Must support mobile responsive design with drawer sidebar

### References
- `projects/frontend/app/src/features/mastra-agents/pages/ConversationalAI.tsx` - Thread ID management and loading states
- `projects/coding-agent-frontend/app/src/app/features/claude-code-agent/services/session-websocket.service.ts` - WebSocket service pattern
- `projects/coding-agent-frontend/app/package.json` - Socket.io client and ngx-markdown dependencies
- `projects/backend/app/src/features/mastra-agents/controllers/mastra-agents.controller.ts` - Startup message endpoint

## Children

| Name | Path | Description |
|------|------|-------------|
| Conversational AI Page Component | ./concerns/component/task.md | Main page component managing thread state and layout |
| Mastra Chat WebSocket Service | ./concerns/service/task.md | Angular service for WebSocket connections and messaging |
| Chat Models and Types | ./concerns/models/task.md | TypeScript interfaces and types for chat entities |
| Chat History Sidebar Component | ./concerns/chat-history-component/task.md | Sidebar component for conversation history and navigation |
| Main Chat Interface Component | ./concerns/chat-interface-component/task.md | Main chat interface with message list and input |
| Message Display Components | ./concerns/message-components/task.md | Components for message display, input, and markdown rendering |