# Chat — Test Plan

## Session Management

- [ ] Sessions list loads on page init via `GET /agent/sessions`
- [ ] First session auto-selected if none active
- [ ] "New Chat" creates session via `POST /agent/sessions` and selects it
- [ ] Deleting active session selects the next available session
- [ ] Each session shows truncated ID and creation time
- [ ] `join:session` emitted via WebSocket when session selected
- [ ] Server responds with `agent:history` containing previous messages

## Messaging

- [ ] User messages appear immediately in the message list (optimistic)
- [ ] Agent responses stream in via `agent:message` WebSocket events
- [ ] Streaming indicator shown while `isStreaming` is true
- [ ] "Stop" button emits `cancel` event to abort streaming
- [ ] `agent:done` event sets `isStreaming` to false
- [ ] `agent:error` event renders error message in message list
- [ ] Message list auto-scrolls to bottom on new messages
- [ ] Enter key sends message; Shift+Enter inserts newline
- [ ] Send button disabled when input is empty
- [ ] Send button disabled when no active session

## Connection

- [ ] WebSocket connects to `/agent` namespace on `ChatPage` init
- [ ] WebSocket disconnects on `ChatPage` destroy
- [ ] Duplicate `connect()` calls are no-ops (no double connections)
- [ ] Connection uses `withCredentials: true`
