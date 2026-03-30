# Mastra Agents

Real-time chat UI package with message streaming, conversation history, and sidebar management for Mastra agent interactions.

## Purpose

Mastra Agents provides a complete, production-ready chat interface for integrating Mastra AI agents into React applications. It handles real-time WebSocket communication, message streaming, conversation management, and responsive UI layout with minimal configuration.

## Usage

```typescript
import { MastraChatWithSidebar } from '@packages/mastra-agents';

export function ChatPage() {
  const [threadId, setThreadId] = useState('thread_initial');
  const userId = 'user-123'; // From auth context

  return (
    <MastraChatWithSidebar
      userId={userId}
      threadId={threadId}
      onThreadChange={setThreadId}
    />
  );
}
```

## Key Features

- **Real-time Streaming**: WebSocket-based streaming responses with live message updates
- **Conversation History**: Persistent sidebar with conversation management and deletion
- **Responsive Layout**: Desktop sidebar with mobile drawer support
- **Message Rendering**: Markdown support with syntax highlighting for code blocks
- **Context Management**: React Context for sharing chat state across components
- **Auto-scroll**: Automatic scrolling during message streaming
- **Accessibility**: ARIA labels and semantic HTML

## Architecture

### Components

| Component | Purpose |
|-----------|---------|
| `MastraChatWithSidebar` | Main container combining chat and conversation history |
| `MastraChat` | Core chat interface with message list and input |
| `ChatProvider` | WebSocket connection provider for chat messages |
| `MessageList` | Displays messages and handles streaming |
| `MessageInput` | Input field with auto-resize and send functionality |
| `MastraChatHistory` | Conversation history sidebar wrapper |
| `HistoryProvider` | WebSocket connection provider for conversation history |
| `ConversationSidebar` | Sidebar UI with new message button and conversation list |
| `ConversationList` | List of previous conversations |

### Data Flow

```
MastraChatWithSidebar
├── MastraChat
│   └── ChatProvider (WebSocket: /mastra-chat)
│       ├── MessageList (subscribes to messages)
│       └── MessageInput (sends messages)
└── MastraChatHistory
    └── HistoryProvider (WebSocket: /mastra-chat-history)
        └── ConversationSidebar
            └── ConversationList
```

## API

### Main Components

#### `MastraChatWithSidebar`

Complete chat interface with sidebar.

```typescript
interface MastraChatWithSidebarProps {
  userId: string;              // User ID for WebSocket auth
  threadId: string;            // Current conversation ID
  onThreadChange: (threadId: string) => void;  // Callback when thread changes
  className?: string;          // Optional CSS class
}
```

**Features:**
- Desktop: Fixed collapsible sidebar
- Mobile: Drawer that collapses when selecting conversation
- Toggle button to hide/show sidebar

#### `MastraChat`

Core chat component without sidebar.

```typescript
interface MastraChatProps {
  userId: string;              // User ID for WebSocket auth
  threadId: string;            // Current conversation ID
  className?: string;          // Optional CSS class
}
```

#### `ChatProvider`

Wraps chat components to establish WebSocket connection.

```typescript
const { isConnected, socket } = useChatContext();
```

**Context Value:**
- `isConnected: boolean` - WebSocket connection status
- `userId: string` - Current user ID
- `threadId: string` - Current thread ID
- `socket: Socket | null` - Socket.io client instance

#### `MessageInput`

Input field for sending messages.

```typescript
interface MessageInputProps {
  disabled?: boolean;          // Disable input
  placeholder?: string;        // Input placeholder text
  className?: string;          // Optional CSS class
}
```

**Features:**
- Auto-resizing textarea (max 120px)
- Shift+Enter for newline, Enter to send
- Send button with loading state
- Keyboard accessibility

#### `MessageList`

Message display container with streaming support.

```typescript
interface MessageListProps {
  className?: string;          // Optional CSS class
  children?: React.ReactNode;  // Child components (e.g., MessageInput)
}

const { addUserMessage, messages } = useMessageList();
```

**Context Value:**
- `messages: Message[]` - All messages in conversation
- `addUserMessage: (content: string) => void` - Add user message to UI

### Hooks

#### `useChatContext()`

Access chat state and WebSocket connection.

```typescript
const context = useChatContext();
// Returns: { isConnected, socket, userId, threadId }
// Throws error if not within ChatProvider
```

#### `useMessageList()`

Access message list state and methods.

```typescript
const { messages, addUserMessage } = useMessageList();
// Throws error if not within MessageList
```

#### `useHistoryContext()`

Access conversation history state.

```typescript
const context = useHistoryContext();
// Returns: { isConnected, socket, userId }
// Throws error if not within HistoryProvider
```

### Types

#### `Message`

```typescript
interface Message {
  id: string;                  // Unique message ID
  role: 'user' | 'assistant';  // Message sender role
  content: string;             // Message text or markdown
  timestamp: Date;             // Message creation time
  isStreaming?: boolean;       // True while streaming response
}
```

#### `Conversation`

```typescript
interface Conversation {
  threadId: string;            // Unique conversation ID
  title: string;               // Conversation title/preview
  updatedAt: Date;             // Last update time
}
```

#### `ConversationHistoryEvent`

```typescript
interface ConversationHistoryEvent {
  conversations: Conversation[];
  type: 'initial' | 'update';
}
```

#### `ResponseChunkEvent`

```typescript
interface ResponseChunkEvent {
  text: string;                // Streamed text chunk
  chunkIndex: number;          // Chunk sequence number
}
```

### Services

#### `MastraChatService`

Utility service for ID generation.

```typescript
MastraChatService.generateThreadId()    // Returns: thread_[timestamp]_[random]
MastraChatService.generateMessageId()   // Returns: msg_[timestamp]_[random]
```

## WebSocket Events

### Chat Events (namespace: `/mastra-chat`)

**Outgoing:**
- `message` - Send user message

**Incoming:**
- `conversation-history` - Initial message history load
- `response-chunk` - Streamed response text
- `response-complete` - Streaming finished
- `chat-error` - Error event

### History Events (namespace: `/mastra-chat-history`)

**Incoming:**
- Conversation list updates with title and timestamp

## Configuration

### Required Environment

- WebSocket server running on same host
- API client package (`@packages/api-client`) for WebSocket client

### Optional Styling

Components use Material-UI theming. Customize via theme provider:

```typescript
import { ThemeProvider, createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark', // or 'light'
  },
});

<ThemeProvider theme={theme}>
  <MastraChatWithSidebar {...props} />
</ThemeProvider>
```

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Public API exports |
| `MastraChatWithSidebar.tsx` | Main component combining chat and sidebar |
| `chat-context.tsx` | Chat context provider (legacy, see ChatProvider) |
| `chat/ChatProvider.tsx` | WebSocket provider for chat |
| `chat/MastraChat.tsx` | Main chat component |
| `chat/chat.service.ts` | Utility service for ID generation |
| `chat/types.ts` | Chat-related type definitions |
| `chat/message-input/MessageInput.tsx` | Input component |
| `chat/message-input/message-input.service.ts` | Input service utilities |
| `chat/message-list/MessageList.tsx` | Message display component |
| `chat/message-list/ChatMessage.tsx` | Individual message component |
| `chat/message-list/MarkdownRenderer.tsx` | Markdown rendering |
| `chat/message-list/CodeBlock.tsx` | Code block with syntax highlighting |
| `chat-history/MastraChatHistory.tsx` | History wrapper component |
| `chat-history/HistoryProvider.tsx` | WebSocket provider for history |
| `chat-history/types.ts` | History-related types |
| `chat-history/conversation-list/ConversationList.tsx` | Conversation list component |
| `chat-history/conversation-sidebar/ConversationSidebar.tsx` | Sidebar wrapper |

## Dependencies

- `@mui/material` - UI components and theming
- `@mui/icons-material` - Material icons
- `socket.io-client` - Real-time WebSocket communication
- `react-markdown` - Markdown rendering
- `react-syntax-highlighter` - Code syntax highlighting
- `rehype-highlight` - Syntax highlighting plugin
- `remark-gfm` - GitHub Flavored Markdown support

## Testing

The package includes comprehensive test coverage:

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Test Files

- `chat/MastraChat.test.tsx` - Component tests
- `chat/MastraChat.integration.test.tsx` - Integration tests
- `chat/ChatProvider.test.tsx` - Context provider tests
- `chat/message-input/MessageInput.test.tsx` - Input component tests
- `chat/message-list/MessageList.test.tsx` - Message list tests
- `chat-history/conversation-list/ConversationList.integration.test.tsx` - History tests

## Common Use Cases

### Basic Chat Page

```typescript
import { useState } from 'react';
import { MastraChatWithSidebar, MastraChatService } from '@packages/mastra-agents';

export function ChatPage() {
  const [threadId, setThreadId] = useState(() =>
    MastraChatService.generateThreadId()
  );

  return (
    <div style={{ height: '100vh' }}>
      <MastraChatWithSidebar
        userId={currentUser.id}
        threadId={threadId}
        onThreadChange={setThreadId}
      />
    </div>
  );
}
```

### Custom Styling

```typescript
import { MastraChatWithSidebar } from '@packages/mastra-agents';

export function ChatPage() {
  return (
    <MastraChatWithSidebar
      userId={userId}
      threadId={threadId}
      onThreadChange={setThreadId}
      className="custom-chat-class"
    />
  );
}
```

### Chat Without Sidebar

```typescript
import { MastraChat, ChatProvider, MastraChatService } from '@packages/mastra-agents';

export function ChatOnly() {
  return (
    <ChatProvider userId={userId} threadId={threadId}>
      <MastraChat userId={userId} threadId={threadId} />
    </ChatProvider>
  );
}
```

## Troubleshooting

### WebSocket Connection Failed

- Verify WebSocket server is running
- Check CORS and WebSocket headers
- Ensure `userId` and `threadId` are provided
- Check browser console for connection errors

### Messages Not Loading

- Verify server is emitting `conversation-history` event
- Check that `userId` matches server records
- Ensure socket is connected before loading thread

### Streaming Not Working

- Verify `response-chunk` event is emitted by server
- Check chunk format matches `ResponseChunkEvent` type
- Ensure `response-complete` event is emitted after all chunks

### Mobile Layout Issues

- Container must have defined `height` (e.g., 100vh)
- Test with viewport meta tags
- Check Material-UI breakpoints match expected behavior
