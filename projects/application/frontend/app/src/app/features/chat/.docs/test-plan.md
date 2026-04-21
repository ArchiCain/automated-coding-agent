# Chat — Test Plan

Each item maps to an acceptance criterion in `spec.md` or a flow in `flows.md`. Citations are relative to `projects/application/frontend/app/src/app/features/chat/`.

## Contract Tests (REST)

- [ ] `GET /agent/sessions` returns 200 with `ChatSession[]`; every row has `{ id, model, createdAt, isActive }` (`services/chat.api.ts:19-21`, `types.ts:2-9`)
- [ ] `POST /agent/sessions` with `{}` body returns 201/200 with a single `ChatSession` (`chat.api.ts:23-29`)
- [ ] `POST /agent/sessions` with `{ model, role }` returns a `ChatSession` echoing `model`/`role`
- [ ] `DELETE /agent/sessions/:id` returns 2xx with empty body for an owned session
- [ ] Unauthenticated request to any of the above triggers 401 refresh-then-retry via `authInterceptor` (cross-feature; not chat-specific)

## Contract Tests (Socket.IO `/agent` namespace)

- [ ] Handshake succeeds when a valid session cookie is present (`withCredentials: true` on the client) (`services/chat.service.ts:30`)
- [ ] Handshake is rejected (no auto-reconnect storm in test env) when no cookie is present
- [ ] Emitting `join:session` with `{ sessionId }` yields an `agent:history` event whose payload matches `SessionHistory`
- [ ] Emitting `message` with `{ sessionId, message }` yields zero or more `agent:message` events followed by exactly one `agent:done`
- [ ] Emitting `cancel` during an in-flight turn halts further `agent:message` events (server-side behavior)
- [ ] An agent failure produces an `agent:error` with `{ message: string }`

## Behavior Tests

### Connection lifecycle
- [ ] Mounting `ChatPage` calls `ChatService.connect()` exactly once (`pages/chat.page.ts:54-57`)
- [ ] Calling `connect()` while a socket already exists is a no-op (`services/chat.service.ts:26`)
- [ ] Destroying `ChatPage` calls `socket.disconnect()` and sets `socket = null` (`chat.service.ts:104-107`, `chat.page.ts:59-61`)

### Session list
- [ ] `loadSessions` populates the `sessions` signal and auto-selects index 0 only when `activeSession()` is null (`chat.service.ts:52-58`)
- [ ] Creating a session prepends it and auto-selects it, emitting `join:session` (`chat.service.ts:68-73`)
- [ ] Deleting the active session selects the next remaining session; if none remain, `activeSession === null` (`chat.service.ts:75-86`)
- [ ] Deleting a non-active session leaves `activeSession` untouched
- [ ] Sidebar renders `id | slice:0:8` and `createdAt | date:'shortTime'` per row (`components/session-sidebar/session-sidebar.component.ts:27-28`)
- [ ] Active row has the `active` class and `var(--app-hover-overlay)` background (`session-sidebar.component.ts:22,54-56`)
- [ ] Clicking the row's delete icon fires `deleteSession` and does NOT fire `selectSession` (stopPropagation) (`session-sidebar.component.ts:32`)

### Messaging
- [ ] `sendMessage(text)` with no active session is a no-op (no socket emit, no message appended) (`chat.service.ts:88-90`)
- [ ] `sendMessage(text)` optimistically appends `{ type:'user', content:text }` before emitting `message` (`chat.service.ts:92-94`)
- [ ] `isStreaming` flips to true on send and back to false on `agent:done` (`chat.service.ts:42-44,93`)
- [ ] `agent:message` events append to the list in the order received (`chat.service.ts:38-40`)
- [ ] `agent:error` appends `{ type:'error', content: err.message }` AND clears `isStreaming` (`chat.service.ts:46-49`)
- [ ] `cancelMessage` emits `cancel` and flips `isStreaming` to false without waiting for the server (`chat.service.ts:97-102`)
- [ ] `selectSession` clears `messages` and `systemPrompt` before emitting `join:session` (`chat.service.ts:61-66`)

### Input behavior
- [ ] Pressing Enter without Shift calls `preventDefault()` and triggers send (`components/message-input/message-input.component.ts:60-65`)
- [ ] Pressing Shift+Enter inserts a newline (no send)
- [ ] Send button is disabled when trimmed `messageText` is empty (`message-input.component.ts:31`)
- [ ] Send button is disabled when `disabled()` input is true (bound to `!activeSession()` in `chat.page.ts:27`)
- [ ] After a successful send, `messageText` is cleared (`message-input.component.ts:71`)
- [ ] While `isStreaming()` is true, the Stop button is shown instead of Send (`message-input.component.ts:26-34`)

### Rendering
- [ ] `user` bubble uses `--app-bg-chat-user`; `assistant` bubble uses `--app-bg-chat-assistant` (`components/message-list/message-list.component.scss:21-31`)
- [ ] `tool_use` rows show `build` icon + `message.tool`; `tool_result` rows show `check_circle` + `message.output` (`message-list.component.html:11-22`)
- [ ] `error` rows show the `error` Material icon in `var(--app-error)` color (`message-list.component.scss:62-67`)
- [ ] `system`-typed messages render nothing (no `@case` branch) — flag as a gap
- [ ] The message list scrolls to bottom (`scrollTop === scrollHeight`) after each `messages` mutation (`message-list.component.ts:21-33`)
- [ ] While `isStreaming()`, the "Agent is working..." spinner renders at the bottom of the list (`message-list.component.html:33-38`)

## E2E Scenarios

- [ ] From `/login`, authenticate → navigate to `/chat` → the sessions list appears and the first session is selected and its history loads
- [ ] Click "New Chat" → a new session is prepended, becomes active, and the message list is empty
- [ ] Type "hello" and press Enter → user bubble appears → agent messages stream in → spinner disappears on `agent:done`
- [ ] Start a long-running turn → click Stop → Stop button reverts to Send immediately
- [ ] Trigger an agent-side failure → `agent:error` renders as a red error row in the list
- [ ] Delete the active session from the sidebar → next session becomes active and its history loads; delete the last session → input becomes disabled
- [ ] Navigate away from `/chat` and back → a fresh socket is opened and sessions reload
