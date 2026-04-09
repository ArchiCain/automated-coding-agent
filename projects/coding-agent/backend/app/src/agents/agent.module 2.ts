import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ProviderModule } from '../providers/provider.module';
import { SharedModule } from '../shared/shared.module';
import { ConfigModule } from '../config/config.module';
import { OrchestratorModule } from '../core/orchestrator.module';
import { GatewayModule } from '../gateway/gateway.module';
import { ExecutionLoopService } from './execution-loop.service';
import { GateRunnerService } from './gates/gate-runner.service';
import { TaskExecutorListener } from './task-executor.listener';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ProviderModule,
    SharedModule,
    ConfigModule,
    OrchestratorModule,
    GatewayModule,
  ],
  providers: [ExecutionLoopService, GateRunnerService, TaskExecutorListener],
  exports: [ExecutionLoopService, GateRunnerService],
})
export class AgentModule {}
