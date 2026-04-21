# Chat Agent — Test Plan

## Contract tests (REST)

- [ ] `POST /agent/sessions` with `{}` returns 201 with `{ id: string (UUID), model: "claude-haiku-4-5", createdAt: ISO string, isActive: true }`.
- [ ] `POST /agent/sessions` with `{ model: "claude-sonnet-4-5" }` returns a session with that model.
- [ ] `GET /agent/sessions` returns an array; after one POST the new session is the first element.
- [ ] `DELETE /agent/sessions/:id` on a known id returns `{ deleted: true }`; on an unknown id returns `{ deleted: false }`.
- [ ] All three endpoints return 401 when no Keycloak session cookie is present.

## Contract tests (Socket.IO)

- [ ] Connecting to `ws://<host>/agent` succeeds with `transports: ['websocket']`.
- [ ] After `join:session { sessionId }`, the client receives exactly one `agent:history` with `{ sessionId, systemPrompt, messages: [] }` for a never-before-used session.
- [ ] Sending `message { sessionId, message: "hello" }` eventually produces exactly one `agent:message` (`type: "assistant"`, `content` is a non-empty string) followed by one `agent:done`.
- [ ] Immediately `join:session { sessionId }` after a completed turn returns `agent:history` with two messages — the `user` message and the `assistant` reply (memory works).
- [ ] Sending `cancel { sessionId }` during an in-flight turn prevents the `agent:message` for that turn (no `agent:done` or `agent:error` assertion required — cancel is fire-and-forget today).

## Behavior tests

- [ ] Without `ANTHROPIC_API_KEY` in the env, sending `message` produces an `agent:error` (authentication failure from the Anthropic SDK).
- [ ] Two concurrent sessions (different `sessionId`) stream independently and their memories do not cross-contaminate.
- [ ] Recall after a process restart returns prior messages for a thread whose LibSQL file is preserved.

## E2E scenarios

- [ ] Authenticated user creates a session via REST, connects to `/agent`, sends a message, sees the assistant reply render in the UI, refreshes the page, re-opens the same session, and sees the full transcript restored.
- [ ] User clicks Stop during a long reply; the partial reply does NOT finalize into the message list (the accumulated text is discarded per current implementation).

## Not in scope

- Token-level streaming UI (service accumulates, emits once per turn).
- Per-user memory scoping (every connection currently shares `resource: "default-user"`).
- Tool use; this agent has no tools.
