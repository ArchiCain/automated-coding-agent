import { Module } from '@nestjs/common';
import { MastraAgentsGateway } from './gateways/mastra-agents.gateway';

@Module({
  providers: [MastraAgentsGateway],
})
export class MastraAgentsModule {}
