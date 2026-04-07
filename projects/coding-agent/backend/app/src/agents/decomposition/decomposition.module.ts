import { Module } from '@nestjs/common';
import { ConfigModule } from '../../config/config.module';
import { ProviderModule } from '../../providers/provider.module';
import { HistoryModule } from '../../history/history.module';
import { OrchestratorModule } from '../../core/orchestrator.module';
import { DecompositionService } from './decomposition.service';
import { TaskQueueService } from './task-queue.service';
import { ConcurrentPoolService } from './concurrent-pool.service';
import { ResourceMonitorService } from './resource-monitor.service';

@Module({
  imports: [ConfigModule, ProviderModule, HistoryModule, OrchestratorModule],
  providers: [
    DecompositionService,
    TaskQueueService,
    ConcurrentPoolService,
    ResourceMonitorService,
  ],
  exports: [
    DecompositionService,
    TaskQueueService,
    ConcurrentPoolService,
    ResourceMonitorService,
  ],
})
export class DecompositionModule {}
