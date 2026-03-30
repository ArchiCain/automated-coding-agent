import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { AgentsService } from '../services/agents.service';
import { AgentConfig, CreateAgentConfigDto, UpdateAgentConfigDto } from '../models/agent-config.model';

@Controller('api/agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  async list(): Promise<{ agents: AgentConfig[] }> {
    const agents = await this.agentsService.listAgents();
    return { agents };
  }

  @Get(':slug/instructions')
  async getInstructions(@Param('slug') slug: string): Promise<{ content: string }> {
    const content = await this.agentsService.readInstructions(slug);
    return { content };
  }

  @Put(':slug/instructions')
  async updateInstructions(
    @Param('slug') slug: string,
    @Body() body: { content: string },
  ): Promise<{ success: boolean }> {
    await this.agentsService.writeInstructions(slug, body.content);
    return { success: true };
  }

  @Get(':slug/sessions/:sessionId/transcript')
  async getSessionTranscript(
    @Param('slug') slug: string,
    @Param('sessionId') sessionId: string,
  ): Promise<{ transcript: string[] }> {
    const transcript = await this.agentsService.readSessionTranscript(slug, sessionId);
    return { transcript };
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<{ agent: AgentConfig }> {
    const agent = await this.agentsService.getAgent(id);
    return { agent };
  }

  @Post()
  async create(@Body() body: CreateAgentConfigDto): Promise<{ agent: AgentConfig }> {
    const agent = await this.agentsService.createAgent(body);
    return { agent };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateAgentConfigDto,
  ): Promise<{ agent: AgentConfig }> {
    const agent = await this.agentsService.updateAgent(id, body);
    return { agent };
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.agentsService.deleteAgent(id);
    return { success: true };
  }

  @Get(':slug/sessions')
  async listSessions(@Param('slug') slug: string): Promise<{ sessions: string[] }> {
    const sessions = await this.agentsService.listSessions(slug);
    return { sessions };
  }
}
