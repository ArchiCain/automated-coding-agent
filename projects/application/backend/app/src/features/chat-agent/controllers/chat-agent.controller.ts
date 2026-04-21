import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { ChatAgentService } from "../services/chat-agent.service";
import type { ChatSession } from "../types";

@Controller("agent/sessions")
export class ChatAgentController {
  constructor(private readonly service: ChatAgentService) {}

  @Get()
  list(): ChatSession[] {
    return this.service.listSessions();
  }

  @Post()
  create(
    @Body() body: { model?: string; role?: string } | undefined,
  ): ChatSession {
    return this.service.createSession(body ?? {});
  }

  @Delete(":id")
  delete(@Param("id") id: string): { deleted: boolean } {
    return { deleted: this.service.deleteSession(id) };
  }
}
