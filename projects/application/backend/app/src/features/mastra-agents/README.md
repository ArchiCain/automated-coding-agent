# Mastra Agents

NestJS integration for AI-powered conversational agents using Mastra framework with streaming support and persistent conversation history.

## Purpose

This package provides a complete agent management system built on the Mastra framework. It enables real-time chat capabilities with LLM models (OpenAI GPT, Anthropic Claude, Google Gemini), maintains conversation history in PostgreSQL, and streams responses to clients via WebSocket gateways.

## Usage

Import the module in your NestJS application:

```typescript
import { MastraAgentsModule } from '@packages/mastra-agents';

@Module({
  imports: [MastraAgentsModule],
})
export class AppModule {}
```

Use the service to interact with agents:

```typescript
import { MastraAgentsService } from '@packages/mastra-agents';

@Controller('chat')
export class ChatController {
  constructor(private readonly mastraAgentsService: MastraAgentsService) {}

  @Post('send-message')
  async sendMessage(
    @Body('message') message: string,
    @Body('userId') userId: string,
    @Body('threadId') threadId: string,
  ) {
    return this.mastraAgentsService.chat(message, { userId, threadId });
  }
}
```

## API

| Export | Type | Description |
|--------|------|-------------|
| MastraAgentsModule | NestJS Module | Main module providing agents and WebSocket gateways |
| MastraAgentsService | Service | Handles chat operations and conversation management |
| MastraService | Service | Manages Mastra instance with agent lifecycle and database storage |
| MastraChatGateway | WebSocket Gateway | Real-time chat streaming via 'mastra-chat' namespace |
| MastraChatHistoryGateway | WebSocket Gateway | Conversation history management via 'mastra-chat-history' namespace |

## Services

### MastraAgentsService

Core service for managing conversations and chat operations.

**Methods:**

- `chat(message: string, options: { userId: string; threadId: string })` - Send a message and get response
- `chatStream(message: string, options: { userId: string; threadId: string; clientId: string })` - Stream response chunks to WebSocket client
- `getConversations(userId: string, clientId: string, type?: 'initial' | 'update')` - Retrieve user's conversations
- `getConversationMessages(threadId: string, clientId: string)` - Get messages in a conversation thread
- `deleteConversation(threadId: string, userId?: string)` - Delete a conversation and notify connected clients

### MastraService

Singleton service managing the Mastra instance and database connectivity.

**Features:**

- PostgreSQL connection management with SSL support
- Agent lifecycle management
- Thread and message storage via Postgres

### WebSocket Gateways

#### MastraChatGateway (namespace: 'mastra-chat')

Handles real-time chat messaging.

**Connection Parameters:**
- `userId` - User identifier (required)
- `threadId` - Conversation thread ID (required)

**Events:**

*Incoming:*
- `send-message` - Client sends message with `{ message: string }`

*Outgoing:*
- `response-chunk` - Streaming text chunks with `{ text: string; chunkIndex: number }`
- `response-complete` - Streaming finished
- `conversation-history` - Initial or updated messages with `{ messages: Message[] }`
- `chat-error` - Error occurred with `{ error: string; details?: string }`

#### MastraChatHistoryGateway (namespace: 'mastra-chat-history')

Manages conversation list and deletion.

**Connection Parameters:**
- `userId` - User identifier (required)

**Events:**

*Incoming:*
- `delete-conversation` - Delete a conversation with `{ threadId: string }`

*Outgoing:*
- `chat-history` - Conversation list with `{ conversations: Conversation[]; type: 'initial' | 'update' }`
- `chat-error` - Error occurred with `{ error: string; details?: string }`

## Configuration

Required environment variables for database connectivity:

| Variable | Description | Required |
|----------|-------------|----------|
| DATABASE_HOST | PostgreSQL hostname | Yes |
| DATABASE_PORT | PostgreSQL port | Yes |
| DATABASE_USERNAME | Database user | Yes |
| DATABASE_PASSWORD | Database password | Yes |
| DATABASE_NAME | Database name | Yes |
| DATABASE_SSL | Enable SSL for RDS (set to 'true') | No |
| CORS_ORIGINS | Comma-separated CORS origins for WebSocket | No |

OpenAI/Claude/Gemini API keys configured via `@ai-sdk/*` packages (set in environment or via config).

## Model Catalog

Available LLM models via `model-catalog.ts`:

**OpenAI:**
- GPT-4o (`gpt-4o`)
- GPT-4o-mini (`gpt-4o-mini`)
- GPT-4.1 (`gpt-4.1`)
- GPT-5 (`gpt-5`)

**Anthropic:**
- Claude 3.7 Sonnet (`claude-3-7-sonnet-latest`)
- Claude Sonnet 4 (`claude-sonnet-4-0`)

**Google:**
- Gemini 2.5 Pro (`gemini-2.5-pro`)

Use `getLLMModel(MODELS.GPT_4_1)` to get provider-specific model instance.

## Files

| File | Purpose |
|------|---------|
| index.ts | Public exports |
| mastra-agents.module.ts | NestJS module definition |
| mastra-agents.service.ts | Core service for chat and conversation management |
| mastra-agents.controller.ts | REST endpoints (startup message endpoint) |
| mastra.service.ts | Mastra instance and database management |
| agents/chat-agent.ts | Chat agent definition with memory and model configuration |
| model-catalog.ts | LLM model definitions and provider resolution |
| gateways/mastra-chat/ | WebSocket chat streaming gateway and event types |
| gateways/mastra-chat-history/ | WebSocket conversation history gateway and event types |
| mastra-agents.service.spec.ts | Service unit tests |
| mastra-agents.controller.spec.ts | Controller unit tests |

## Key Features

- **Multi-model support** - Switch between OpenAI, Anthropic, and Google models
- **Real-time streaming** - Stream response chunks via WebSocket to clients
- **Persistent storage** - PostgreSQL backend for thread and message persistence
- **Conversation history** - Track and retrieve previous messages in threads
- **Event-driven architecture** - Internal pub/sub system for coordinated updates
- **Memory management** - Mastra's working memory for context-aware responses
- **Auto-generated titles** - Threads get automatic titles based on conversation
- **Multi-client support** - Handle multiple clients per user with synchronized updates

## Dependencies

- `@mastra/core` - Core agent and Mastra framework
- `@mastra/memory` - Memory management for agents
- `@mastra/pg` - PostgreSQL storage adapter
- `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google` - LLM providers
- `@nestjs/*` - NestJS framework and extensions
- `socket.io` - WebSocket library for real-time communication
- `pg` - PostgreSQL client
