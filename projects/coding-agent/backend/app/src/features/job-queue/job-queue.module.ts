import { Module } from '@nestjs/common';
import { JobQueueService } from './services/job-queue.service';
import { JobQueueController } from './controllers/job-queue.controller';
import { JobQueueGateway } from './gateway/job-queue.gateway';
import { AutoDecompWorker } from './workers/auto-decomp.worker';
import { ClaudeCodeAgentModule } from '../claude-code-agent/claude-code-agent.module';

@Module({
  imports: [ClaudeCodeAgentModule],
  controllers: [JobQueueController],
  providers: [JobQueueService, JobQueueGateway, AutoDecompWorker],
  exports: [JobQueueService],
})
export class JobQueueModule {}
