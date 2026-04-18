# Chat — Flows

## Starting a Chat Session

1. User navigates to `/chat`
2. `ChatPage.ngOnInit()` calls `ChatService.connect()` and `ChatService.loadSessions()`
3. WebSocket connects to `/agent` namespace
4. Sessions load via `GET /agent/sessions`
5. First session is auto-selected; `join:session` emitted via WebSocket
6. Server responds with `agent:history` containing previous messages

## Sending a Message

1. User types in textarea, presses Enter (or clicks Send)
2. `MessageInputComponent` emits `sendMessage` with the text
3. `ChatService.sendMessage()` appends user message to `messages` signal, sets `isStreaming = true`, emits `message` via WebSocket
4. Server streams back `agent:message` events (appended to messages)
5. Server emits `agent:done` — `isStreaming` set to false

## Cancelling a Response

1. User clicks "Stop" button while streaming
2. `ChatService.cancelMessage()` emits `cancel` via WebSocket
3. `isStreaming` set to false immediately

## Creating a New Session

1. User clicks "New Chat" in sidebar
2. `ChatApiService.createSession()` sends `POST /agent/sessions`
3. New session prepended to `sessions` signal
4. New session is auto-selected (`join:session` emitted)

## Deleting a Session

1. User clicks delete icon on a session row
2. `ChatApiService.deleteSession()` sends `DELETE /agent/sessions/:id`
3. Session removed from `sessions` signal
4. If deleted session was active, next available session is selected
