# Chat Agent — Spec

## What it is

The backend side of the chat feature. It manages chat sessions and runs conversational turns against an Anthropic-backed AI assistant with per-session memory. The frontend talks to it over REST for session lifecycle and over a live socket connection for turn-by-turn conversation.

## How it behaves

### Serving session CRUD over REST

The backend exposes three endpoints under `/agent/sessions`: list, create, and delete. Listing returns the current in-memory set of sessions sorted newest first, using the last-message time when present and falling back to creation time. Creating a session generates a new id, stamps it with the default model and the creation time, marks it active, and returns it. Deleting by id removes the session from the in-memory list and, if a turn is in-flight for that session, aborts it. These REST routes sit behind the globally-registered Keycloak JWT guard, so an unauthenticated caller is rejected.

### Accepting a chat connection

The backend exposes the chat namespace as a live socket endpoint. A client connecting is accepted without authentication — the gateway does not apply the JWT guard that protects REST. Every connection is treated as the same Mastra memory "resource" (the literal `"default-user"`), so all clients currently share one namespace of saved conversations.

### Replaying history

When a client asks to join a session, the backend looks up the saved transcript for that session's thread in the conversation memory store, normalizes each stored message into the shape the frontend expects, and replies once with a history payload containing those messages plus the current system prompt. If the memory store has nothing for that thread, or if the recall fails, the backend replies with an empty message list (still including the system prompt) and logs a warning.

### Handling a turn

When a client sends a user message for a session, the backend runs one agent turn. It records the send time on the session, opens a streamable call to the agent (scoped to that session's thread and the shared resource), and accumulates the assistant's text as it streams back. When the stream finishes, the backend emits a single assistant message carrying the full accumulated text, then emits a done signal. If the stream throws, the backend emits an error event carrying a human-readable message instead — no assistant message and no done signal are emitted for that turn.

### Cancel

When a client asks to cancel a session's in-flight turn, the backend aborts the underlying stream via its `AbortController` and drops it from the active-streams map. The accumulating loop notices the aborted signal and stops; no further assistant message is emitted for that turn. Cancel on a session with no in-flight turn is a no-op.

## Acceptance criteria

- [ ] `POST /agent/sessions` with an empty body returns a session with a generated id, model `claude-haiku-4-5`, and `isActive: true`.
- [ ] `GET /agent/sessions` returns the in-process session list sorted by `lastMessageAt` desc, falling back to `createdAt`.
- [ ] `DELETE /agent/sessions/:id` removes the session from the in-memory list and aborts any in-flight stream for it.
- [ ] REST endpoints under `/agent/sessions` reject unauthenticated requests via the global Keycloak JWT guard.
- [ ] A client connecting to the chat namespace is accepted without authentication.
- [ ] After joining a session, the client receives exactly one history event containing the prior messages for that thread plus the current system prompt.
- [ ] Sending a user message produces exactly one assistant message (carrying the full accumulated text) followed by one done event when the turn completes successfully.
- [ ] Successive user messages in the same session include prior turns in the agent's context (memory is working).
- [ ] Canceling during an in-flight turn aborts the Anthropic request and prevents any assistant message from being emitted for that turn.
- [ ] An error in the agent stream produces a single error event with a human-readable message string, and no assistant/done events for that turn.

## Known gaps

- The chat namespace is unauthenticated today. The REST side is protected by the global JWT guard, but the socket gateway does not apply it, so any client can connect.
- Every socket connection is mapped to the same memory resource (`"default-user"`). Until the gateway resolves the caller's identity, all users share one namespace of threads.
- Session metadata (id, model, createdAt, lastMessageAt, isActive) is kept in an in-process `Map` and is lost on backend restart. Message history itself is durable in the LibSQL file.
- Token streaming is server-accumulated. The backend consumes the agent's token deltas internally but only emits one assistant message per turn at the end — there is no live-token UI path yet.
- The agent has no tools wired in. Turns only produce assistant text; the tool-use and tool-result message types exist in the payload shape for the frontend's benefit but are never emitted by this backend.

## Code map

Paths are relative to `projects/application/backend/app/src/features/chat-agent/`.

| Concern | File · lines |
|---|---|
| REST routes under `/agent/sessions` (list, create, delete) | `controllers/chat-agent.controller.ts:5-25` |
| Socket namespace `/agent` and its inbound/outbound events | `gateways/chat-agent.gateway.ts:13-65` |
| Join handler → emits history | `gateways/chat-agent.gateway.ts:22-31` |
| Message handler → emits assistant message then done, or error | `gateways/chat-agent.gateway.ts:33-54` |
| Cancel handler → aborts the in-flight stream | `gateways/chat-agent.gateway.ts:56-60` |
| Unauthenticated socket: every connection → `"default-user"` resource | `gateways/chat-agent.gateway.ts:11,62-64` |
| In-memory session list + active-streams map | `services/chat-agent.service.ts:7-11` |
| Create session (generates id, stamps `createdAt`, `isActive: true`) | `services/chat-agent.service.ts:12-23` |
| List sessions sorted by `lastMessageAt` desc, falling back to `createdAt` | `services/chat-agent.service.ts:25-31` |
| Delete session aborts any in-flight stream | `services/chat-agent.service.ts:33-37` |
| Recall saved transcript + current system prompt for a thread | `services/chat-agent.service.ts:39-60` |
| Run one agent turn, accumulate text, yield one assistant message | `services/chat-agent.service.ts:62-98` |
| Cancel aborts `AbortController` and drops it from the map | `services/chat-agent.service.ts:100-106` |
| Normalize stored memory messages into `ChatMessage` shape | `services/chat-agent.service.ts:109-140` |
| Lazily-cached Mastra agent with Anthropic Haiku + memory | `agents/chat.agent.ts:10-31` |
| Default model `claude-haiku-4-5` and fixed system prompt | `agents/chat.agent.ts:6-8` |
| LibSQL memory store (`CHAT_MEMORY_DB_URL`, default `file:./chat-memory.db`) | `agents/chat.agent.ts:15-20` |
| Types: `ChatSession`, `ChatMessage`, `SessionHistory` | `types.ts` |
| NestJS module wiring controller + gateway + service | `chat-agent.module.ts` |
| Global Keycloak JWT guard that protects REST (not the socket) | `../../app.module.ts:26-31` |

### Environment

| Variable | Purpose | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | Read automatically by `@ai-sdk/anthropic` | required |
| `CHAT_MEMORY_DB_URL` | LibSQL URL for conversation memory | `file:./chat-memory.db` |
