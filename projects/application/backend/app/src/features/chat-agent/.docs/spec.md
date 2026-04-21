# Chat Agent — Spec

## Purpose

Provides a simple conversational chat backend powered by a single Mastra agent (Anthropic Haiku by default) with per-session memory. The frontend `chat` feature connects to this over Socket.IO for turn-by-turn conversation and over REST for session lifecycle.

## Behavior

- Exposes REST endpoints under `/agent/sessions` for creating, listing, and deleting chat sessions (`controllers/chat-agent.controller.ts:8-24`).
- Exposes a Socket.IO namespace `/agent` with three inbound events — `join:session`, `message`, `cancel` — and four outbound events — `agent:history`, `agent:message`, `agent:done`, `agent:error` (`gateways/chat-agent.gateway.ts:15-67`).
- A single Mastra `Agent` named `chat-agent` is lazily constructed once per process and reused for every session (`agents/chat.agent.ts:11-28`).
- The agent uses Anthropic Haiku (`claude-haiku-4-5`) via `@ai-sdk/anthropic` and a fixed system prompt: `"You are a helpful AI assistant."` (`agents/chat.agent.ts:7-9`).
- Conversation memory is persisted per session via `@mastra/memory` with a `LibSQLStore` backend (file at `./chat-memory.db` by default, overridable via `CHAT_MEMORY_DB_URL`) (`agents/chat.agent.ts:15-19`).
- Session metadata (id, model, createdAt, lastMessageAt, isActive) is kept in-memory inside `ChatAgentService` and is lost on backend restart; message history is durable in the LibSQL file (`services/chat-agent.service.ts:10-12`).
- When a client emits `join:session`, the server replies once with `agent:history` containing the saved messages for that thread plus the current system prompt (`gateways/chat-agent.gateway.ts:23-32`).
- When a client emits `message`, the server runs one agent turn and replies with a single `agent:message` (`type: 'assistant'`, full accumulated text) followed by `agent:done`. On failure it emits `agent:error` with `{ message }` instead (`services/chat-agent.service.ts:60-90`, `gateways/chat-agent.gateway.ts:34-55`).
- `cancel` aborts the in-flight stream for the given session via `AbortController` (`services/chat-agent.service.ts:92-98`).
- REST is protected by the global `KeycloakJwtGuard` registered in `app.module.ts:27-30`; the WebSocket gateway does NOT apply that guard and currently treats every connection as the same `DEFAULT_RESOURCE` Mastra memory resource (`gateways/chat-agent.gateway.ts:11,63-65`).

## Components

| File | Role |
|---|---|
| `agents/chat.agent.ts` | Lazily-cached Mastra `Agent` with memory + Anthropic Haiku |
| `services/chat-agent.service.ts` | Session list, history recall, streaming turn, cancel |
| `gateways/chat-agent.gateway.ts` | Socket.IO `/agent` namespace |
| `controllers/chat-agent.controller.ts` | REST `/agent/sessions` |
| `types.ts` | `ChatSession`, `ChatMessage`, `SessionHistory` |
| `chat-agent.module.ts` | NestJS module wiring controller + gateway + service |

## Environment

| Variable | Purpose | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | Read automatically by `@ai-sdk/anthropic` | required |
| `CHAT_MEMORY_DB_URL` | LibSQL URL for memory storage | `file:./chat-memory.db` |

## Acceptance Criteria

- [ ] `POST /agent/sessions` with an empty body returns a `ChatSession` with a generated `id`, `model: "claude-haiku-4-5"`, and `isActive: true`.
- [ ] `GET /agent/sessions` returns the in-process session list sorted by `lastMessageAt` desc (falling back to `createdAt`).
- [ ] `DELETE /agent/sessions/:id` removes the session from the in-memory list and aborts any in-flight stream for it.
- [ ] A WebSocket client connecting to `/agent` can emit `join:session` with a known `sessionId` and receives one `agent:history` event containing the prior messages for that Mastra thread.
- [ ] Emitting `message` with `{ sessionId, message }` produces exactly one `agent:message` (`type: "assistant"`) followed by one `agent:done` when the turn completes successfully.
- [ ] Successive `message` events in the same session include prior turns in the agent's context (memory is working).
- [ ] Emitting `cancel` during an in-flight turn aborts the Anthropic request and prevents further `agent:message` events for that turn.
- [ ] An error in the agent stream produces a single `agent:error` with a human-readable `message` string.
