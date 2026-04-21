# Chat Agent — Contracts

All paths relative to `projects/application/backend/app/src/features/chat-agent/`.

## REST: `/agent/sessions`

### `GET /agent/sessions`
- **Auth:** required (global `KeycloakJwtGuard`)
- **Handler:** `ChatAgentController.list` (`controllers/chat-agent.controller.ts:10-13`)
- **Response:** `ChatSession[]`, sorted by `lastMessageAt ?? createdAt` desc

### `POST /agent/sessions`
- **Auth:** required
- **Handler:** `ChatAgentController.create` (`controllers/chat-agent.controller.ts:15-19`)
- **Request body:**
  ```ts
  { model?: string; role?: string }
  ```
- **Response:** `ChatSession` with a fresh `id`, defaulted `model`

### `DELETE /agent/sessions/:id`
- **Auth:** required
- **Handler:** `ChatAgentController.delete` (`controllers/chat-agent.controller.ts:21-24`)
- **Response:** `{ deleted: boolean }` — `true` if the session existed

## Socket.IO: namespace `/agent`

- **Gateway options:** `cors: { origin: true, credentials: true }` (`gateways/chat-agent.gateway.ts:13-15`)
- **Auth on handshake:** none today — every connection maps to `resource: "default-user"` in Mastra memory (`gateways/chat-agent.gateway.ts:11,64`). Future work: extract user from the Keycloak cookie.

### Client → Server

#### `join:session`
```ts
{ sessionId: string }
```
Handler: `ChatAgentGateway.handleJoin` (`gateways/chat-agent.gateway.ts:17-32`). Emits one `agent:history` in reply.

#### `message`
```ts
{ sessionId: string; message: string }
```
Handler: `ChatAgentGateway.handleMessage`. Runs one agent turn and emits `agent:message` + `agent:done` (or `agent:error`).

#### `cancel`
```ts
{ sessionId: string }
```
Handler: `ChatAgentGateway.handleCancel`. Aborts the in-flight stream for that session.

### Server → Client

#### `agent:history`
```ts
{ sessionId: string; systemPrompt: string; messages: ChatMessage[] }  // SessionHistory
```
Sent once after `join:session`. `messages` are hydrated from Mastra memory (`services/chat-agent.service.ts:37-58`).

#### `agent:message`
```ts
ChatMessage  // shape below
```
Currently emitted **once per turn** with the fully-accumulated assistant text and `type: "assistant"`. Token-level deltas are accumulated server-side and not streamed to the client.

#### `agent:done`
No payload. Signals the end of a turn.

#### `agent:error`
```ts
{ message: string }
```

## Shared Types (`types.ts`)

```ts
interface ChatSession {
  id: string;
  model: string;
  role?: string;
  createdAt: string;       // ISO timestamp
  lastMessageAt?: string;  // ISO timestamp
  isActive: boolean;
}

type ChatMessageType =
  | "user" | "assistant" | "tool_use" | "tool_result" | "error" | "system";

interface ChatMessage {
  type: ChatMessageType;
  sessionId?: string;
  content?: string;
  tool?: string;
  input?: unknown;
  output?: unknown;
}

interface SessionHistory {
  sessionId: string;
  systemPrompt: string;
  messages: ChatMessage[];
}
```

Shapes match the frontend `chat` feature's `types.ts` exactly.
