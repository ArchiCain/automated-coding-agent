# Chat — Contracts

Frontend-observed shapes. Base URL is `${AppConfigService.backendUrl}` (default `/api`). Citations are relative to `projects/application/frontend/app/`.

> Status: the backend has no `/agent` REST controller or Socket.IO gateway wired (confirmed by searching `projects/application/backend/app/src` for `WebSocketGateway`, `/agent/sessions`, `AgentModule` — no matches). These contracts describe what the frontend expects, not what the backend currently serves. See `spec.md` Discrepancies.

## Shared Types

From `src/app/features/chat/types.ts`:

```ts
// types.ts:1-9
interface ChatSession {
  id: string;
  model: string;
  role?: string;
  createdAt: string;     // ISO timestamp, rendered via DatePipe 'shortTime'
  lastMessageAt?: string;
  isActive: boolean;
}

// types.ts:11-19
interface ChatMessage {
  type: 'user' | 'assistant' | 'tool_use' | 'tool_result' | 'error' | 'system';
  sessionId?: string;
  content?: string;        // user, assistant, error, system
  tool?: string;           // tool_use
  input?: unknown;         // tool_use
  output?: unknown;        // tool_result (rendered as-is via interpolation)
}

// types.ts:21-26
interface SessionHistory {
  sessionId: string;
  systemPrompt: string;
  messages: ChatMessage[];
}
```

## REST Endpoints

All calls go through `ChatApiService` (`src/app/features/chat/services/chat.api.ts`). Every request sets `withCredentials: true` per call (the `authInterceptor` also adds it).

### `GET /agent/sessions`

- **Auth:** Required (cookie-based, via `authInterceptor`)
- **Caller:** `ChatApiService.getSessions` (`chat.api.ts:19-21`) → `ChatService.loadSessions` on `ChatPage.ngOnInit`
- **Request body:** none
- **Response:** `ChatSession[]`

### `POST /agent/sessions`

- **Auth:** Required
- **Caller:** `ChatApiService.createSession` (`chat.api.ts:23-29`) → triggered by "New Chat"
- **Request body:**
  ```ts
  { model?: string; role?: string }
  ```
  Currently only `role` is ever passed by `ChatService.createSession(role?)` (`chat.service.ts:68-73`), and no code path passes a `role`, so in practice the body is `{ model: undefined, role: undefined }` which serializes to `{}`.
- **Response:** `ChatSession`

### `DELETE /agent/sessions/:id`

- **Auth:** Required
- **Caller:** `ChatApiService.deleteSession(id)` (`chat.api.ts:31-33`)
- **Path params:** `id` — session id
- **Request body:** none
- **Response:** `void` (any 2xx)

## Socket.IO

### Connection

```ts
// chat.service.ts:28-31
io(`${backendUrl}/agent`, {
  transports: ['websocket', 'polling'],
  withCredentials: true,
});
```

- **Namespace:** `/agent`
- **Transports:** `websocket` preferred, falls back to `polling`
- **Auth:** session cookie (via `withCredentials`); the backend is expected to read the cookie on the WS handshake. The frontend does not send an explicit token.

### Client → Server events (emit)

#### `join:session`
Emitted on every `selectSession` call (`chat.service.ts:65`).
```ts
{ sessionId: string }
```

#### `message`
Emitted by `sendMessage` (`chat.service.ts:94`).
```ts
{ sessionId: string; message: string }
```

#### `cancel`
Emitted by `cancelMessage` (`chat.service.ts:100`).
```ts
{ sessionId: string }
```

### Server → Client events (listen)

All listeners are registered in `ChatService.connect()` (`chat.service.ts:33-49`).

#### `agent:history`
Full replay for the session the client just joined.
```ts
{ sessionId: string; systemPrompt: string; messages: ChatMessage[] }   // SessionHistory
```
Effect: `systemPrompt.set(history.systemPrompt)`, `messages.set(history.messages)`.

#### `agent:message`
Single incremental message emitted during an agent turn (user echo is NOT expected — the frontend appends its own user message optimistically before emitting `message`).
```ts
ChatMessage
```
Effect: appended to the `messages` signal.

#### `agent:done`
Marker that the agent has finished the current turn.
```ts
// no payload used
```
Effect: `isStreaming.set(false)`.

#### `agent:error`
```ts
{ message: string }
```
Effect: `messages.update(m => [...m, { type:'error', content: error.message }])` and `isStreaming.set(false)`.

## Error shapes (observed on the frontend)

- Socket disconnect / connect failure: no listener is registered today for `connect_error`, `disconnect`, or `reconnect_*` events — the user sees no feedback on transport issues.
- REST 401: handled globally by `authInterceptor` (refresh + retry); not chat-specific.
- REST 5xx/4xx: the `.subscribe()` callbacks have no `error` handler; errors bubble to the default RxJS unhandled-error hook and the UI does not recover (`chat.service.ts:53,69,76`).
