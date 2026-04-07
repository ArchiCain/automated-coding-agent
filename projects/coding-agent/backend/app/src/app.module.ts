import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import * as path from 'path';

// Legacy feature modules (kept for backward compatibility during migration)
import { CorsModule } from './features/cors';
import { HealthModule } from './features/health';
import { ClaudeCliModule } from './features/shared/claude-cli';

// THE Dev Team modules
import { ConfigModule } from './config/config.module';
import { SharedModule } from './shared/shared.module';
import { ProviderModule } from './providers/provider.module';
import { SkillModule } from './skills/skill.module';
import { OrchestratorModule } from './core/orchestrator.module';
import { AgentModule } from './agents/agent.module';
import { DecompositionModule } from './agents/decomposition/decomposition.module';
import { StateModule } from './state/state.module';
import { HistoryModule } from './history/history.module';
import { GatewayModule } from './gateway/gateway.module';

@Module({
  imports: [
    // NestJS infrastructure
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: (() => {
        // Walk up from cwd to find the repo root .env
        const paths = ['.env'];
        let dir = process.cwd();
        while (dir !== path.dirname(dir)) {
          dir = path.dirname(dir);
          const envPath = path.join(dir, '.env');
          try { require('fs').accessSync(envPath); paths.unshift(envPath); break; } catch {}
        }
        return paths;
      })(),
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),

    // Legacy modules
    CorsModule,
    HealthModule,
    ClaudeCliModule,

    // THE Dev Team core
    ConfigModule,
    SharedModule,
    ProviderModule,
    SkillModule,
    OrchestratorModule,
    AgentModule,
    DecompositionModule,
    StateModule,
    HistoryModule,
    GatewayModule,
  ],
})
export class AppModule {}
