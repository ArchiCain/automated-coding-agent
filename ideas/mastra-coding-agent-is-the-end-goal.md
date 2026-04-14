# Mastra as the Coding Agent Orchestration Layer

## The Problem

We currently have two SDK integrations in `projects/the-dev-team/backend/app/src/features/agent/providers/`:

- **Claude Code SDK** (`claude-code.provider.ts`) — works, but only gives us 5 built-in file tools (`Read`, `Write`, `Edit`, `Glob`, `Grep`) on top of what our MCP server already provides
- **Open Code SDK** (`opencode.provider.ts`) — unimplemented stub, throws on query

Everything interesting (git, sandbox, worktree management — 17 tools total) is already in our own MCP server (`mcp-server.ts`). The SDKs are mostly giving us the agentic loop (tool call -> result -> continue) and file operations.

## Why Mastra

Mastra is a TypeScript AI agent framework that replaces both SDKs with one orchestration layer:

1. **Agentic loop** — handles the tool call -> result -> continue cycle automatically (the main thing we'd lose dropping the SDKs)
2. **Native MCP support** — `MCPClient` connects directly to our existing `mcp-server.ts` via stdio, no changes needed to our 17 tools
3. **Multi-provider LLMs** — swap between Claude, OpenAI, Gemini, local models with `"anthropic/claude-opus-4-6"` / `"openai/gpt-5"` style strings. This solves the dead OpenCode provider — instead of two SDK integrations, one framework routes to any model
4. **Streaming** — full streaming support including tool call events, which our WebSocket gateway needs

## Migration Plan

### Keep as-is
- `mcp-server.ts` (all 17 tools) — Mastra connects to it as an MCP client
- WebSocket gateway, agent controller, session management

### Replace
- `claude-code.provider.ts` -> Mastra agent with our MCP server as a toolset
- `opencode.provider.ts` -> same Mastra agent, different model string
- `provider-registry.ts` -> simplified, since Mastra handles provider routing

### Add to MCP
- `read_file`, `write_file`, `edit_file`, `glob`, `grep` tools in `mcp-server.ts` (the 5 built-ins we currently get from Claude Code SDK)

## Before vs After

### Current Architecture
- Claude Code SDK for Claude + built-in file tools
- OpenCode SDK (unimplemented) for eventually something
- Our MCP server for everything interesting (git, sandbox, worktree)

### Target Architecture
- **One orchestration layer** (Mastra) that talks to any model
- **One tool surface** (all MCP) that's model-agnostic
- No SDK vendor lock-in

The provider-registry pattern we built is essentially what Mastra already does at a more mature level. We'd delete boilerplate and gain model flexibility.

## Risks

- Mastra is still relatively young (post-1.0 but evolving fast). We'd be trading Anthropic's SDK stability for a more feature-rich but faster-moving dependency.
- Need to verify their streaming event format maps cleanly to what our `AgentGateway` expects before committing.
- The `Edit` tool's diff-based editing logic (find unique old_string, replace with new_string) needs to be reimplemented in our MCP server — straightforward but worth getting right to avoid token waste and edit errors.
