import { Module } from '@nestjs/common';
import { MastraAgentsGateway } from './gateways/mastra-agents.gateway';
import { SyncSetupController } from './controllers/sync-setup.controller';

@Module({
  controllers: [SyncSetupController],
  providers: [MastraAgentsGateway],
})
export class MastraAgentsModule {}
