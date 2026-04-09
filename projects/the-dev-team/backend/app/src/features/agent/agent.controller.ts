import { Controller, Post, Get, Delete, Param, Body, HttpCode } from '@nestjs/common';
import { AgentService } from './agent.service';

@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('sessions')
  createSession(@Body() body: { model?: string; provider?: string }) {
    return this.agentService.createSession(body?.model, body?.provider);
  }

  @Get('sessions')
  listSessions() {
    return this.agentService.listSessions();
  }

  @Get('sessions/:id')
  getSession(@Param('id') id: string) {
    return this.agentService.getSession(id);
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  deleteSession(@Param('id') id: string) {
    this.agentService.deleteSession(id);
  }

  @Post('sessions/:id/cancel')
  cancelSession(@Param('id') id: string) {
    this.agentService.cancelSession(id);
    return { cancelled: true };
  }
}
