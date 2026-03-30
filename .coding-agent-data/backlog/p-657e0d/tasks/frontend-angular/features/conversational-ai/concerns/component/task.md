---
id: t-f9e2a1
parent: t-c8a5f1
created: 2026-01-26T17:46:00.000Z
updated: 2026-01-26T17:46:00.000Z
---

# Task: Conversational AI Page Component

## Purpose
Create the main conversational AI page component that manages thread state, handles loading states, and coordinates the chat interface layout using Angular standalone component patterns.

## Context

### Conventions
Follow Angular 19+ standalone component patterns established in the codebase:
- Use `@Component({ standalone: true })` with no NgModules
- Import specific Material modules needed (CommonModule, MatProgressSpinnerModule, etc.)
- Use signal-based state management with `signal()` and `computed()`
- Handle loading states with skeleton or spinner components
- Reference: `projects/coding-agent-frontend/app/src/app/features/dashboard/pages/dashboard-home/dashboard-home.ts` (lines 33-154)

### Interfaces
```typescript
interface ConversationalAIPageProps {
  // Managed internally via authentication service
  userId: string;
  threadId: string;
  isLoading: boolean;
}

interface ThreadManagement {
  generateThreadId: () => string;
  loadThreadId: () => string | null;
  storeThreadId: (threadId: string) => void;
}
```

### Boundaries
- **Exposes**: Main page component at `/` route for conversational AI
- **Consumes**: Authentication service for user data, session storage for thread persistence
- **Constraints**: Must handle loading states before rendering chat interface, integrate with existing layout patterns

### References
- `projects/frontend/app/src/features/mastra-agents/pages/ConversationalAI.tsx` - Thread ID management and loading patterns
- `projects/coding-agent-frontend/app/src/app/features/dashboard/pages/dashboard-home/dashboard-home.ts` - Angular component structure and loading states
- `projects/frontend/app/src/features/mastra-agents/chat/chat.service.ts` - Thread ID generation service

## Specification

### Requirements
- Create main page component following Angular standalone patterns
- Manage thread ID state using session storage with fallback to generation
- Handle authentication state and user loading
- Display loading spinner during initialization
- Coordinate layout between chat interface and sidebar components
- Support responsive design for mobile and desktop

### Files
- `src/features/conversational-ai/pages/conversational-ai.page.ts` - Main page component
- `src/features/conversational-ai/pages/conversational-ai.page.html` - Component template
- `src/features/conversational-ai/pages/conversational-ai.page.scss` - Component styles

### Acceptance Criteria
- [ ] Component loads user authentication state
- [ ] Manages thread ID with sessionStorage persistence
- [ ] Generates new thread ID if none exists
- [ ] Shows loading spinner while initializing
- [ ] Renders chat interface once loaded
- [ ] Supports thread switching via callback
- [ ] Follows Angular Material design patterns
- [ ] Uses signal-based reactive state management