# Chat — Requirements

**Feature directory:** `src/app/features/chat/`
**Page:** `/chat`

## What It Does

Real-time chat interface for conversing with an AI agent. Supports multiple sessions, WebSocket-based message streaming, and session management (create, select, delete).

## Components, Pages & Services

| Item | Type | Purpose |
|---|---|---|
| `ChatPage` | Page | Top-level page composing sidebar, message list, and input. Connects/disconnects WebSocket on init/destroy. |
| `MessageListComponent` | Component | Renders list of `ChatMessage` objects. Auto-scrolls to bottom on new messages. Shows spinner while streaming. |
| `MessageInputComponent` | Component | Textarea with send/stop buttons. Enter sends (Shift+Enter for newline). Disabled when no active session. |
| `SessionSidebarComponent` | Component | Left panel listing sessions. "New Chat" button, session selection, delete per session. 260px wide. |
| `ChatService` | Service | State management via signals. Manages Socket.IO connection to `/agent` namespace, emits/receives messages. |
| `ChatApiService` | Service | HTTP client for session CRUD (`GET /agent/sessions`, `POST /agent/sessions`, `DELETE /agent/sessions/:id`). |

## Types

- `ChatSession` — `id`, `model`, `role?`, `createdAt`, `lastMessageAt?`, `isActive`
- `ChatMessage` — `type` (user/assistant/tool_use/tool_result/error/system), `content?`, `tool?`, `input?`, `output?`
- `SessionHistory` — `sessionId`, `systemPrompt`, `messages`

## Architecture

- Socket.IO connects to `{backendUrl}/agent` with `withCredentials: true`.
- Events: `join:session` (emit), `message` (emit), `cancel` (emit), `agent:history` (receive), `agent:message` (receive), `agent:done` (receive), `agent:error` (receive).
- `ChatService` is `providedIn: 'root'`. State is held in signals: `sessions`, `activeSession`, `messages`, `systemPrompt`, `isStreaming`.
- `ChatApiService` handles REST calls for session lifecycle; WebSocket handles real-time messaging.

## Acceptance Criteria

### Session Management
- [ ] Sessions list loads on page init
- [ ] First session is auto-selected if none active
- [ ] "New Chat" creates a session via API and selects it
- [ ] Deleting the active session selects the next available session
- [ ] Each session shows truncated ID and creation time

### Messaging
- [ ] User messages appear immediately in the list
- [ ] Agent responses stream in via WebSocket
- [ ] Streaming indicator shown while `isStreaming` is true
- [ ] "Stop" button emits `cancel` event to abort streaming
- [ ] Error messages render in the message list
- [ ] Message list auto-scrolls to bottom on new messages
- [ ] Enter sends message; Shift+Enter inserts newline
- [ ] Send button disabled when input is empty or no active session

### Connection
- [ ] WebSocket connects on `ChatPage` init
- [ ] WebSocket disconnects on `ChatPage` destroy
- [ ] Duplicate `connect()` calls are no-ops
