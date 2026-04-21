# Chat Agent — Flows

All line refs are relative to `projects/application/backend/app/src/features/chat-agent/`.

## Flow 1: Client joins a session

1. Client emits `join:session { sessionId }` on the `/agent` namespace.
2. `ChatAgentGateway.handleJoin` resolves `resourceId` (currently the constant `"default-user"`) (`gateways/chat-agent.gateway.ts:17-25`).
3. `ChatAgentService.getHistory(sessionId, resourceId)` pulls the cached Mastra agent (`services/chat-agent.service.ts:40-41`) and calls `memory.recall({ threadId, resourceId })` (`services/chat-agent.service.ts:46-49`).
4. Each Mastra message is mapped to a `ChatMessage` — `role: 'user' → 'user'`, `'assistant' → 'assistant'`, `'tool' → 'tool_result'`, else `'system'` — and its `content` is normalized to a string (`services/chat-agent.service.ts:110-131`).
5. Gateway emits `agent:history { sessionId, systemPrompt, messages }` to just the requesting client.

If memory recall throws, the service logs a warning and returns an empty history with the current system prompt (`services/chat-agent.service.ts:53-57`).

## Flow 2: User sends a message (happy path)

1. Client emits `message { sessionId, message }`.
2. `ChatAgentGateway.handleMessage` resolves `resourceId` and iterates `service.streamAssistantTurn(sessionId, resourceId, message)` (`gateways/chat-agent.gateway.ts:34-49`).
3. `streamAssistantTurn` registers a new `AbortController` for the session, updates `session.lastMessageAt`, and calls `agent.stream([{role:"user", content: message}], { memory: { thread: sessionId, resource: resourceId }, abortSignal })` (`services/chat-agent.service.ts:60-78`).
4. Mastra persists the user message to the LibSQL-backed memory thread and begins the Anthropic request.
5. The service consumes `result.fullStream`, concatenating every `text-delta` chunk's text into an accumulator (`services/chat-agent.service.ts:82-89`).
6. When the stream ends, the service yields a single `ChatMessage` `{ sessionId, type: "assistant", content: accum }` (`services/chat-agent.service.ts:91`).
7. Mastra writes the assistant message to memory as part of stream cleanup.
8. Gateway emits `agent:message` with that message, then emits `agent:done` (`gateways/chat-agent.gateway.ts:43-47`).
9. Service removes the `AbortController` from `activeStreams` in `finally` (`services/chat-agent.service.ts:93`).

## Flow 3: Cancel an in-flight turn

1. Client emits `cancel { sessionId }`.
2. `ChatAgentGateway.handleCancel` calls `service.cancel(sessionId)` (`gateways/chat-agent.gateway.ts:57-60`).
3. The stored `AbortController` is aborted; Mastra/ai-sdk propagate the abort to the Anthropic HTTP request (`services/chat-agent.service.ts:94-97`).
4. The `for await` loop in `streamAssistantTurn` breaks on the next chunk, the generator yields no assistant message, and the `message` handler falls through to `agent:done`.
5. No `agent:error` is emitted for a user-initiated cancel.

## Flow 4: Agent error

1. Client emits `message { sessionId, message }`.
2. `agent.stream()` or `fullStream` iteration throws (missing API key, HTTP error, invalid model, etc.).
3. The generator exits via `finally`, releasing the abort controller (`services/chat-agent.service.ts:93`).
4. Gateway `catch` formats the error message and emits `agent:error { message }` (`gateways/chat-agent.gateway.ts:50-54`). No `agent:done` is emitted for this turn.

## Flow 5: Session lifecycle (REST)

1. FE `POST /agent/sessions` with body `{}` → `ChatAgentService.createSession` assigns `id = randomUUID()`, defaults `model`, pushes into the in-memory `sessions` Map, returns the new session (`services/chat-agent.service.ts:14-25`).
2. FE `GET /agent/sessions` → `listSessions` returns `Array.from(sessions.values())` sorted by `lastMessageAt ?? createdAt` descending (`services/chat-agent.service.ts:27-33`).
3. FE `DELETE /agent/sessions/:id` → `deleteSession` aborts any active stream for the session and removes it from the map; the LibSQL-backed memory thread for that id remains on disk but is no longer reachable from the REST list (`services/chat-agent.service.ts:35-39`).

## Flow 6: Cold start / first request

1. First call to `getChatAgent()` constructs `LibSQLStore` (creating `chat-memory.db` if absent), then `Memory`, then `Agent`, and caches the result (`agents/chat.agent.ts:13-26`).
2. Subsequent calls return the cached instance in O(1); re-initialization only happens on process restart.
