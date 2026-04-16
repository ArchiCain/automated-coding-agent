import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HealthModule } from './features/health';
import { CorsModule } from './features/cors';
import { AgentModule } from './features/agent';
import { ClusterModule } from './features/cluster';
import { TaskRunnerModule } from './features/task-runner';
import { RouterModule } from './features/router';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    HealthModule,
    CorsModule,
    AgentModule,
    ClusterModule,
    TaskRunnerModule,
    RouterModule,
  ],
})
export class AppModule {}
