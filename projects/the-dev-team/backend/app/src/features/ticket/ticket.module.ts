import { Module } from '@nestjs/common';
import { AgentModule } from '../agent';
import { TicketService } from './ticket.service';
import { TicketEngineService } from './ticket-engine.service';
import { WatchdogService } from './watchdog.service';
import { TicketController } from './ticket.controller';
import { TicketGateway } from './ticket.gateway';

@Module({
  imports: [AgentModule],
  controllers: [TicketController],
  providers: [TicketService, TicketEngineService, WatchdogService, TicketGateway],
  exports: [TicketService],
})
export class TicketModule {}
