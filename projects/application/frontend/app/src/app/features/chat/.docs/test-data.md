# Chat — Test Data

Minimal fixtures for unit/E2E tests. Shapes are derived from `src/app/features/chat/types.ts` and the listener/emit payloads in `src/app/features/chat/services/chat.service.ts`.

## Sessions

```json
[
  {
    "id": "11111111-1111-4111-8111-111111111111",
    "model": "claude-opus-4-7",
    "role": "engineer",
    "createdAt": "2026-04-20T13:00:00.000Z",
    "lastMessageAt": "2026-04-20T13:05:00.000Z",
    "isActive": true
  },
  {
    "id": "22222222-2222-4222-8222-222222222222",
    "model": "claude-opus-4-7",
    "createdAt": "2026-04-20T12:00:00.000Z",
    "isActive": false
  }
]
```

## Socket.IO payloads

### Server → client

`agent:history`:
```json
{
  "sessionId": "11111111-1111-4111-8111-111111111111",
  "systemPrompt": "You are a helpful engineer.",
  "messages": [
    { "type": "user", "content": "ping" },
    { "type": "assistant", "content": "pong" }
  ]
}
```

`agent:message` — assistant chunk:
```json
{ "type": "assistant", "content": "Working on it..." }
```

`agent:message` — tool use:
```json
{ "type": "tool_use", "tool": "bash", "input": { "cmd": "ls /" } }
```

`agent:message` — tool result:
```json
{ "type": "tool_result", "tool": "bash", "output": "bin\netc\nhome\n" }
```

`agent:done`: no payload.

`agent:error`:
```json
{ "message": "Agent execution failed: tool timeout" }
```

### Client → server

`join:session`:
```json
{ "sessionId": "11111111-1111-4111-8111-111111111111" }
```

`message`:
```json
{ "sessionId": "11111111-1111-4111-8111-111111111111", "message": "Write a function that reverses a string." }
```

`cancel`:
```json
{ "sessionId": "11111111-1111-4111-8111-111111111111" }
```

## Runtime configuration

`public/config.json` must be served by the dev server / reverse proxy:
```json
{ "backendUrl": "/api" }
```

Socket.IO then connects to `/api/agent`. In a sandbox with a direct backend URL, set `backendUrl` to e.g. `https://api.<sandbox>.tail<tailnet>.ts.net`.

## Auth

Chat requires the same cookie-based session the rest of the app uses. Reuse the standard test account from the keycloak-auth test data; the Socket.IO handshake carries the cookie via `withCredentials: true`.
