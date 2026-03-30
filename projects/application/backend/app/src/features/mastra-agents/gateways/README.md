# Gateway Pattern

This document describes the architectural pattern used for all WebSocket gateways in this application.

## Overview

Gateways use a clear input/output pattern to handle bidirectional communication between clients and the server.

## Pattern

### Inputs: Subscribe Messages (`@SubscribeMessage()`)

- **Direction:** Client → Server
- **Purpose:** Client-initiated requests and commands
- **Decorator:** `@SubscribeMessage('event.name')`
- **Use Case:** Clients send data or trigger actions on the server

**Example:**
```typescript
@SubscribeMessage('send-message')
handleSendMessage(@MessageBody() data: SendMessageDto) {
  // Handle client request to send message
}
```

### Outputs: Event Listeners (`@OnEvent()`)

- **Direction:** Server → Client
- **Purpose:** Server-initiated updates and notifications
- **Decorator:** `@OnEvent('event.name')`
- **Use Case:** Server pushes updates to connected clients

**Example:**
```typescript
@OnEvent('mastra.chat.chunk')
handleChatChunk(payload: ChatChunkEvent) {
  // Broadcast chunk to connected client
  this.server.to(payload.clientId).emit('response-chunk', payload);
}
```

## Benefits

1. **Separation of Concerns** - Clear distinction between client requests and server updates
2. **Event-Driven Architecture** - Leverages NestJS EventEmitter2 for internal pub/sub
3. **Decoupling** - Business logic can emit events without knowing about WebSocket connections
4. **Scalability** - Any service can emit events that automatically reach WebSocket clients

## Flow

```
Client Request → @SubscribeMessage() → Business Logic → emit() → @OnEvent() → Server Push → Client
```

1. Client sends WebSocket message
2. `@SubscribeMessage()` handler processes request
3. Business logic executes and emits internal events
4. `@OnEvent()` handlers catch internal events
5. Gateway pushes updates to connected clients

## Note on Terminology

While `@OnEvent()` methods are technically "input listeners" (listening to internal events), they serve as **outputs** from a gateway perspective because their function is to push data out to clients.
