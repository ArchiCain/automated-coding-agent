import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HealthModule } from './features/health';
import { CorsModule } from './features/cors';
import { AgentModule } from './features/agent';
import { ClusterModule } from './features/cluster';
import { TaskRunnerModule } from './features/task-runner';
import { TicketModule } from './features/ticket';
import { MastraAgentsModule } from './features/mastra-agents';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    HealthModule,
    CorsModule,
    AgentModule,
    ClusterModule,
    TaskRunnerModule,
    TicketModule,
    MastraAgentsModule,
  ],
})
export class AppModule {}
