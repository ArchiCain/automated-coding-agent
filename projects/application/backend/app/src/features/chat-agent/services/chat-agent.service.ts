import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import { getChatAgent, SYSTEM_PROMPT, DEFAULT_MODEL } from "../agents/chat.agent";
import type { ChatSession, ChatMessage, SessionHistory } from "../types";

@Injectable()
export class ChatAgentService {
  private readonly logger = new Logger(ChatAgentService.name);
  private readonly sessions = new Map<string, ChatSession>();
  private readonly activeStreams = new Map<string, AbortController>();

  createSession(params: { model?: string; role?: string }): ChatSession {
    const session: ChatSession = {
      id: randomUUID(),
      model: params.model ?? DEFAULT_MODEL,
      role: params.role,
      createdAt: new Date().toISOString(),
      isActive: true,
    };
    this.sessions.set(session.id, session);
    this.logger.log(`Created session ${session.id}`);
    return session;
  }

  listSessions(): ChatSession[] {
    return Array.from(this.sessions.values()).sort((a, b) => {
      const aKey = a.lastMessageAt ?? a.createdAt;
      const bKey = b.lastMessageAt ?? b.createdAt;
      return bKey.localeCompare(aKey);
    });
  }

  deleteSession(id: string): boolean {
    this.activeStreams.get(id)?.abort();
    this.activeStreams.delete(id);
    return this.sessions.delete(id);
  }

  async getHistory(sessionId: string, resourceId: string): Promise<SessionHistory> {
    const agent = getChatAgent();
    const memory = await agent.getMemory();
    if (!memory) {
      return { sessionId, systemPrompt: SYSTEM_PROMPT, messages: [] };
    }
    try {
      const result = await memory.recall({
        threadId: sessionId,
        resourceId,
      } as Parameters<typeof memory.recall>[0]);
      const messages: ChatMessage[] = result.messages.map((m) => ({
        sessionId,
        type: mapRoleToType(m.role),
        content: normalizeContent(m.content),
      }));
      return { sessionId, systemPrompt: SYSTEM_PROMPT, messages };
    } catch (err) {
      this.logger.warn(`Failed to recall ${sessionId}: ${errorMessage(err)}`);
      return { sessionId, systemPrompt: SYSTEM_PROMPT, messages: [] };
    }
  }

  async *streamAssistantTurn(
    sessionId: string,
    resourceId: string,
    userMessage: string,
  ): AsyncGenerator<ChatMessage> {
    const agent = getChatAgent();
    const abort = new AbortController();
    this.activeStreams.set(sessionId, abort);

    const session = this.sessions.get(sessionId);
    if (session) session.lastMessageAt = new Date().toISOString();

    try {
      const result = await agent.stream(
        [{ role: "user", content: userMessage }],
        {
          memory: { thread: sessionId, resource: resourceId },
          abortSignal: abort.signal,
        },
      );

      let accum = "";
      for await (const chunk of result.fullStream as AsyncIterable<{
        type: string;
        payload?: { text?: string };
      }>) {
        if (abort.signal.aborted) break;
        if (chunk.type === "text-delta" && chunk.payload?.text) {
          accum += chunk.payload.text;
        }
      }

      yield { sessionId, type: "assistant", content: accum };
    } finally {
      this.activeStreams.delete(sessionId);
    }
  }

  cancel(sessionId: string): void {
    const ctrl = this.activeStreams.get(sessionId);
    if (ctrl) {
      ctrl.abort();
      this.activeStreams.delete(sessionId);
    }
  }
}

function mapRoleToType(role: string): ChatMessage["type"] {
  if (role === "user") return "user";
  if (role === "assistant") return "assistant";
  if (role === "tool") return "tool_result";
  return "system";
}

function normalizeContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map(partToText).join("");
  }
  if (content && typeof content === "object") {
    const obj = content as {
      content?: unknown;
      parts?: unknown;
    };
    if (typeof obj.content === "string") return obj.content;
    if (Array.isArray(obj.parts)) {
      return obj.parts.map(partToText).join("");
    }
  }
  return "";
}

function partToText(part: unknown): string {
  if (typeof part === "string") return part;
  if (part && typeof part === "object" && "text" in part) {
    return String((part as { text: unknown }).text ?? "");
  }
  return "";
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
