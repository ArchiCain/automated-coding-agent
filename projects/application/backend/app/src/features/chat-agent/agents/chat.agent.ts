import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { anthropic } from "@ai-sdk/anthropic";

export const DEFAULT_MODEL = "claude-haiku-4-5";

export const SYSTEM_PROMPT = "You are a helpful AI assistant.";

let cachedAgent: Agent | null = null;

export function getChatAgent(): Agent {
  if (cachedAgent) return cachedAgent;

  const memory = new Memory({
    storage: new LibSQLStore({
      id: "chat-agent-memory",
      url: process.env.CHAT_MEMORY_DB_URL ?? "file:./chat-memory.db",
    }),
  });

  cachedAgent = new Agent({
    id: "chat-agent",
    name: "chat-agent",
    instructions: SYSTEM_PROMPT,
    model: anthropic(DEFAULT_MODEL),
    memory,
  });

  return cachedAgent;
}
