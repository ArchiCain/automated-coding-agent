import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HealthModule } from './features/health';
import { CorsModule } from './features/cors';
import { AgentModule } from './features/agent';
import { ClusterModule } from './features/cluster';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    HealthModule,
    CorsModule,
    AgentModule,
    ClusterModule,
  ],
})
export class AppModule {}
