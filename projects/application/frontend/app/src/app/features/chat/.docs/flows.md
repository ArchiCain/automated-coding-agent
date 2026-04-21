# Chat — Flows

All citations are paths relative to repo root under `projects/application/frontend/app/`.

## Flow 1: Page load and session auto-select (happy path)

1. User navigates to `/chat`; the route lazy-loads `ChatPage` (`src/app/app.routes.ts`).
2. `ChatPage.ngOnInit` runs (`src/app/features/chat/pages/chat.page.ts:54-57`):
   1. `ChatService.connect()` — opens `io('${backendUrl}/agent', { transports:['websocket','polling'], withCredentials:true })`. Registers listeners for `agent:history`, `agent:message`, `agent:done`, `agent:error` (`services/chat.service.ts:25-50`).
   2. `ChatService.loadSessions()` — subscribes to `ChatApiService.getSessions()` which sends `GET ${backendUrl}/agent/sessions` (`services/chat.api.ts:19-21`).
3. Response sets the `sessions` signal. If `sessions.length > 0 && !activeSession()`, the first session is passed to `selectSession(sessions[0])` (`services/chat.service.ts:52-58`).
4. `selectSession(session)` sets `activeSession`, clears `messages` and `systemPrompt`, then emits `join:session` with `{ sessionId: session.id }` (`services/chat.service.ts:61-66`).
5. Server replies with `agent:history` → listener sets `systemPrompt` and replaces `messages` with `history.messages` (`services/chat.service.ts:33-36`).
6. `MessageListComponent.effect` fires on `messages` change and `setTimeout(0)`-scrolls the container to bottom (`components/message-list/message-list.component.ts:21-33`).

## Flow 2: Create a new session

1. User clicks "New Chat" in `SessionSidebarComponent` (`components/session-sidebar/session-sidebar.component.ts:14-16`).
2. `createSession` output fires; `ChatPage` template binds this to `chat.createSession()` (`pages/chat.page.ts:19`).
3. `ChatService.createSession(role?)` calls `ChatApiService.createSession(undefined, role)` which sends `POST ${backendUrl}/agent/sessions` with body `{ model: undefined, role }` (`services/chat.api.ts:23-29`, `services/chat.service.ts:68-73`). Note: no caller currently passes `role`, so body is effectively `{}`.
4. On success, the returned `ChatSession` is prepended to `sessions` and passed to `selectSession(session)` — emits `join:session` for the new session.
5. Server replies with `agent:history` (expected to be empty for a fresh session).

## Flow 3: Send a message (streaming response)

1. User types in the textarea. `messageText` signal updates via `ngModel` (`components/message-input/message-input.component.ts:16,58`).
2. User presses Enter (without Shift). `onEnter(event)` calls `event.preventDefault()` then `send()` (`message-input.component.ts:60-65`).
3. `send()` trims the text; if non-empty, emits `sendMessage` output and clears `messageText` (`message-input.component.ts:67-73`).
4. `ChatPage` routes to `chat.sendMessage($event)` (`pages/chat.page.ts:29`).
5. `ChatService.sendMessage(content)`:
   1. Returns silently if `!activeSession() || !socket` (`services/chat.service.ts:89-90`).
   2. Appends `{ type:'user', content }` to `messages` (optimistic) (`services/chat.service.ts:92`).
   3. Sets `isStreaming = true` (`services/chat.service.ts:93`).
   4. Emits Socket.IO event `message` with `{ sessionId, message: content }` (`services/chat.service.ts:94`).
6. While streaming, `MessageInputComponent` shows the "Stop" button (`message-input.component.ts:26-34`) and `MessageListComponent` shows the "Agent is working..." spinner (`components/message-list/message-list.component.html:33-38`).
7. Server streams zero or more `agent:message` events. Each `ChatMessage` is appended to `messages` (`services/chat.service.ts:38-40`). The `effect` in `MessageListComponent` scrolls to bottom on every update.
8. Server emits `agent:done`. `isStreaming` flips to false; Send button returns (`services/chat.service.ts:42-44`).

## Flow 4: Cancel an in-flight response

1. User clicks "Stop" while `isStreaming()` is true (`message-input.component.ts:27`).
2. `cancelMessage` output fires → `ChatPage` calls `chat.cancelMessage()` (`pages/chat.page.ts:30`).
3. `ChatService.cancelMessage()`:
   1. Returns silently if no active session or no socket.
   2. Emits `cancel` with `{ sessionId }` (`services/chat.service.ts:100`).
   3. Sets `isStreaming = false` immediately — does not wait for server ack (`services/chat.service.ts:101`).
4. If the server still emits `agent:message` events after cancel, they will continue to append (no client-side filtering).

## Flow 5: Delete a session

1. User clicks the `close` icon on a session row. `$event.stopPropagation()` prevents the surrounding row-click from firing `selectSession`; `deleteSession` output emits the `ChatSession` (`components/session-sidebar/session-sidebar.component.ts:30-36`).
2. `ChatPage` calls `chat.deleteSession($event)` (`pages/chat.page.ts:18`).
3. `ChatService.deleteSession(session)` subscribes to `DELETE ${backendUrl}/agent/sessions/:id` (`services/chat.api.ts:31-33`, `services/chat.service.ts:75-86`).
4. On 2xx, the service removes the session from `sessions`. If the deleted session was active:
   - If at least one session remains, `activeSession` is set to the first remaining and `selectSession` is called (re-emits `join:session`).
   - Otherwise `activeSession` becomes `null` and no `join:session` is emitted.

## Flow 6: Error from agent

1. Server emits `agent:error` with `{ message: string }` (`services/chat.service.ts:46-49`).
2. Listener appends `{ type:'error', content: error.message }` to `messages`. `MessageListComponent` renders it with the red `error` icon (`components/message-list/message-list.component.html:23-28`).
3. `isStreaming` flips to false. Send button returns.

## Flow 7: Page destroy / navigation away

1. User navigates away; Angular calls `ChatPage.ngOnDestroy()` (`pages/chat.page.ts:59-61`).
2. `ChatService.disconnect()` calls `socket.disconnect()` and sets `socket = null` (`services/chat.service.ts:104-107`). The service itself stays alive (root-provided) but with no socket, so `sendMessage`/`cancelMessage` calls would no-op until the user re-enters `/chat` and `connect()` runs again.
3. `ChatService.ngOnDestroy` would also disconnect, but only fires if the entire injector is torn down (`services/chat.service.ts:109-112`).

## Flow 8: Backend contract

The backend serves these endpoints and events from the `chat-agent` feature (`projects/application/backend/app/src/features/chat-agent/`). Its `.docs/` is authoritative for server-side behavior — see `backend/app/src/features/chat-agent/.docs/flows.md` for the matching server traces.
