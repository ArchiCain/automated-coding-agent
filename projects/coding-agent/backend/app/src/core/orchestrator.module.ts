import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '../config/config.module';
import { SharedModule } from '../shared/shared.module';
import { StateModule } from '../state/state.module';
import { TaskIntakeService } from './task-intake.service';
import { AgentPoolService } from './agent-pool.service';
import { EnvironmentManagerService } from './environment-manager.service';
import { SessionManagerService } from './session-manager.service';
import { SchedulerService } from './scheduler.service';
import { PRManagerService } from './pr-manager.service';
import { PRReviewWatcherService } from './pr-review-watcher.service';
import { OrchestratorController } from './orchestrator.controller';

@Module({
  imports: [ConfigModule, SharedModule, StateModule, ScheduleModule.forRoot()],
  controllers: [OrchestratorController],
  providers: [
    TaskIntakeService,
    AgentPoolService,
    EnvironmentManagerService,
    SessionManagerService,
    SchedulerService,
    PRManagerService,
    PRReviewWatcherService,
  ],
  exports: [
    TaskIntakeService,
    AgentPoolService,
    EnvironmentManagerService,
    SessionManagerService,
    SchedulerService,
    PRManagerService,
    PRReviewWatcherService,
  ],
})
export class OrchestratorModule {}
