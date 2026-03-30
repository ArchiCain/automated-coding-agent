import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { CorsModule } from "./features/cors";
import { HealthModule } from "./features/health";
import { ClaudeCliModule } from "./features/shared/claude-cli";
import { ClaudeCodeAgentModule } from "./features/claude-code-agent/claude-code-agent.module";
import { JobQueueModule } from "./features/job-queue";
import { TaskRunnerModule } from "./features/task-runner";
import { CommandCenterModule } from "./features/command-center";
import { ProjectsModule } from "./features/projects";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    EventEmitterModule.forRoot(),
    CorsModule,
    HealthModule,
    ClaudeCliModule,
    ClaudeCodeAgentModule,
    JobQueueModule,
    TaskRunnerModule,
    CommandCenterModule,
    ProjectsModule,
  ],
})
export class AppModule {}
