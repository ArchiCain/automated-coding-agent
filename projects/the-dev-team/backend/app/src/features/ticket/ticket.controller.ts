import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AgentService } from '../agent/agent.service';
import { TicketService } from './ticket.service';
import { CreateTicketDto, TicketStatus, AgentRoleName } from './ticket.types';

@Controller('tickets')
export class TicketController {
  constructor(
    private readonly ticketService: TicketService,
    private readonly agentService: AgentService,
  ) {}

  @Get()
  listTickets(
    @Query('status') status?: TicketStatus,
    @Query('role') role?: AgentRoleName,
    @Query('planId') planId?: string,
  ) {
    return this.ticketService.listTickets({ status, role, planId });
  }

  @Get(':id')
  getTicket(@Param('id') id: string) {
    return this.ticketService.getTicket(id);
  }

  @Get(':id/handoffs')
  getHandoffs(@Param('id') id: string) {
    return this.ticketService.readHandoffs(id);
  }

  @Post()
  createTicket(@Body() dto: CreateTicketDto) {
    return this.ticketService.createTicket(dto);
  }

  @Post(':id/stop')
  @HttpCode(HttpStatus.OK)
  stopTicket(@Param('id') id: string) {
    const ticket = this.ticketService.getTicket(id);

    // Cancel the active agent session if one exists
    if (ticket.activeAgent) {
      try {
        this.agentService.cancelSession(ticket.activeAgent.sessionId);
      } catch {
        // Session may already be gone
      }
      this.ticketService.retireAgent(id, 'stopped_manually');
    }

    return this.ticketService.updateTicketStatus(id, 'stopped_manually', 'user', 'Stopped by user');
  }
}
