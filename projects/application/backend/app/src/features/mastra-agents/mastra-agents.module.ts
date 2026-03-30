import { Module } from "@nestjs/common";
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MastraService } from "./services/mastra.service";
import { MastraAgentsService } from "./services/mastra-agents.service";
import { MastraAgentsController } from "./controllers/mastra-agents.controller";
import { MastraChatGateway } from './gateways/mastra-chat/mastra-chat.gateway';
import { MastraChatHistoryGateway } from './gateways/mastra-chat-history/mastra-chat-history.gateway';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
  ],
  controllers: [MastraAgentsController],
  providers: [
    MastraAgentsService,
    MastraService,
    MastraChatGateway,
    MastraChatHistoryGateway,
  ],
  exports: [MastraAgentsService, MastraService],
})
export class MastraAgentsModule {}
