# Chat — Spec

## Purpose

Real-time chat surface at `/chat` that connects to the AI agent over Socket.IO and a small REST API. Users pick or create a session in a left sidebar, stream user/assistant/tool messages in the center pane, and send or cancel turns from a textarea at the bottom. State is held in a `providedIn: 'root'` service so the connection survives component recomposition but is explicitly opened/closed by `ChatPage`.

## Behavior

### Connection
- On `ChatPage` init, `ChatService.connect()` opens a Socket.IO client to `${backendUrl}/agent` with `transports: ['websocket', 'polling']` and `withCredentials: true` (`src/app/features/chat/services/chat.service.ts:25-31`).
- Duplicate `connect()` calls are no-ops — the method returns early when `socket !== null` (`chat.service.ts:26`).
- `ChatPage.ngOnInit` also calls `loadSessions()` (`src/app/features/chat/pages/chat.page.ts:54-57`).
- On page destroy, `disconnect()` calls `socket.disconnect()` and nulls the reference (`chat.service.ts:104-107`, `chat.page.ts:59-61`). `ChatService.ngOnDestroy` also disconnects as a safety net (`chat.service.ts:109-112`).

### Session management (REST)
- Sessions load via `GET /agent/sessions` (`src/app/features/chat/services/chat.api.ts:19-21`). First session is auto-selected when the list is non-empty and none is currently active (`chat.service.ts:53-58`).
- "New Chat" calls `POST /agent/sessions` with body `{ model?, role? }` (only `role` is ever passed today — `model` is always `undefined`, `chat.service.ts:68-73`). The returned session is prepended and auto-selected.
- Delete calls `DELETE /agent/sessions/:id`. If the deleted session was active, the first remaining session is selected; if none remain, `activeSession` is set to `null` (`chat.service.ts:75-86`).
- All HTTP calls pass `withCredentials: true` per call, redundant with `authInterceptor` (`chat.api.ts:20,27,32`).

### Messaging (Socket.IO)
- `selectSession(session)` clears `messages` and `systemPrompt`, then emits `join:session` with `{ sessionId }` (`chat.service.ts:61-66`).
- Server replies with `agent:history` carrying `{ sessionId, systemPrompt, messages }`; the service stores `systemPrompt` and replaces the message list (`chat.service.ts:33-36`).
- `sendMessage(content)` optimistically appends `{ type: 'user', content }`, sets `isStreaming = true`, and emits `message` with `{ sessionId, message }` (`chat.service.ts:88-95`). Returns silently if no session or no socket.
- Incoming `agent:message` events are appended to the message list (`chat.service.ts:38-40`).
- `agent:done` sets `isStreaming = false` (`chat.service.ts:42-44`).
- `agent:error` appends `{ type: 'error', content: <error.message> }` and sets `isStreaming = false` (`chat.service.ts:46-49`).
- `cancelMessage()` emits `cancel` with `{ sessionId }` and immediately flips `isStreaming` to false — does not wait for server acknowledgement (`chat.service.ts:97-102`).

### UI
- `ChatPage` renders a flex row: 260px `SessionSidebarComponent` + flex `chat-main` column containing `MessageListComponent` (grows) and `MessageInputComponent` (footer). The page uses `height: calc(100vh - 64px); margin: -24px` to fill the layout viewport under the 64px toolbar (`chat.page.ts:35-47`).
- `MessageListComponent` auto-scrolls to the bottom whenever the `messages` input changes via an `effect()` + `setTimeout(0)` (`src/app/features/chat/components/message-list/message-list.component.ts:21-33`).
- Message bubble styling per `type`: `user`/`assistant` as bubbles, `tool_use` with warning left border + `build` icon, `tool_result` with success left border + `check_circle` icon, `error` as red text + `error` icon. `system` exists in the type union but has no `@case` branch and is not rendered (`message-list.component.html:4-29`).
- While `isStreaming()` is true, a spinner + "Agent is working..." label render below the message list (`message-list.component.html:33-38`).
- `MessageInputComponent`: `mat-form-field` outline textarea with `cdkTextareaAutosize` (1–6 rows). Enter sends, Shift+Enter inserts newline (`message-input.component.ts:17-24,60-65`). While `isStreaming()`, the Send button is replaced with a red `mat-flat-button color="warn"` Stop button that emits `cancelMessage`. Send is disabled when the trimmed text is empty OR `disabled()` is true (`ChatPage` binds `disabled = !activeSession()`, `chat.page.ts:27`, `message-input.component.ts:31`).
- `SessionSidebarComponent`: 260px wide, "New Chat" `mat-flat-button` at top, `mat-nav-list` of sessions showing `id | slice:0:8` and `createdAt | date:'shortTime'` with a close-icon delete button per row (`session-sidebar.component.ts:13-40,43-50`). Active row gets `background-color: var(--app-hover-overlay)`.

## Components / Services

| Name | Type | Purpose |
|---|---|---|
| `ChatPage` | Page (`app-chat-page`) | Composes sidebar/list/input; calls `connect/loadSessions` on init, `disconnect` on destroy (`chat.page.ts:50-62`) |
| `SessionSidebarComponent` | Component | Session list, create/select/delete (`session-sidebar.component.ts`) |
| `MessageListComponent` | Component | Renders `ChatMessage[]`; auto-scrolls; shows streaming spinner (`message-list.component.ts`) |
| `MessageInputComponent` | Component | Autosizing textarea; Enter-sends; toggles Send/Stop (`message-input.component.ts`) |
| `ChatService` | `@Injectable({providedIn:'root'})` | Socket.IO client + signal state (`sessions`, `activeSession`, `messages`, `systemPrompt`, `isStreaming`) (`chat.service.ts`) |
| `ChatApiService` | `@Injectable({providedIn:'root'})` | REST client for `/agent/sessions` CRUD (`chat.api.ts`) |
| `ChatModule` | NgModule (thin wrapper) | Re-exports standalone components (`chat.module.ts`) |

## Types (`types.ts`)

- `ChatSession { id, model, role?, createdAt, lastMessageAt?, isActive }`
- `ChatMessage { type: 'user'|'assistant'|'tool_use'|'tool_result'|'error'|'system'; sessionId?; content?; tool?; input?; output? }`
- `SessionHistory { sessionId, systemPrompt, messages }`

## Acceptance Criteria

### Connection
- [ ] Socket.IO connects to `${backendUrl}/agent` with `withCredentials: true` on `ChatPage` init
- [ ] Duplicate `connect()` calls do not open a second socket
- [ ] Socket disconnects on `ChatPage` destroy

### Session management
- [ ] `GET /agent/sessions` runs on page init
- [ ] First session is auto-selected only when none is currently active
- [ ] "New Chat" calls `POST /agent/sessions`, prepends the result, and selects it
- [ ] Deleting the active session selects the next remaining session; if none remain, `activeSession` becomes `null`
- [ ] Each session row shows the first 8 chars of `id` and `createdAt` formatted as `shortTime`
- [ ] Selecting a session emits `join:session` with `{ sessionId }` and clears prior messages

### Messaging
- [ ] Sending emits `message` with `{ sessionId, message }` and optimistically appends a user message
- [ ] `agent:history` replaces the message list and stores `systemPrompt`
- [ ] `agent:message` events are appended in order
- [ ] `agent:done` clears the streaming indicator
- [ ] `agent:error` appends an `error`-typed message and clears the streaming indicator
- [ ] Stop button emits `cancel` with `{ sessionId }` and immediately clears the streaming indicator
- [ ] Enter sends; Shift+Enter inserts a newline
- [ ] Send button is disabled when the trimmed input is empty or no session is active
- [ ] Message list scrolls to the bottom on every change to `messages`

### Rendering
- [ ] `user`/`assistant` messages render as bubbles with theme tokens
- [ ] `tool_use` renders with a `build` icon + tool name
- [ ] `tool_result` renders with a `check_circle` icon + `output`
- [ ] `error` renders with an `error` icon in `--app-error` color
