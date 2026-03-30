import { Module } from '@nestjs/common';
import { ClaudeCodeAgentController } from './controllers/claude-code-agent.controller';
import { BrainstormingController } from './controllers/brainstorming.controller';
import { DecompositionController } from './controllers/decomposition.controller';
import { ExecutionController } from './controllers/execution.controller';
import { ReviewController } from './controllers/review.controller';
import { EnvironmentController } from './controllers/environment.controller';
import { PromptsController } from './controllers/prompts.controller';
import { AgentsController } from './controllers/agents.controller';
import { FilesystemController } from './controllers/filesystem.controller';
import { BrainstormingService } from './services/brainstorming.service';
import { DecompositionService } from './services/decomposition.service';
import { ExecutionService } from './services/execution.service';
import { ReviewService } from './services/review.service';
import { EnvironmentService } from './services/environment.service';
import { SessionService } from './services/session.service';
import { PromptsService } from './services/prompts.service';
import { AgentsService } from './services/agents.service';
import { SessionGateway } from './gateway/session.gateway';
import { EnvironmentGateway } from './gateway/environment.gateway';
import { ClaudeCodeProvider } from './providers/claude-code.provider';
import { OpenCodeProvider } from './providers/opencode.provider';
import { AgentProviderRegistry } from './providers/agent-provider-registry';

@Module({
  controllers: [
    ClaudeCodeAgentController,
    BrainstormingController,
    DecompositionController,
    ExecutionController,
    ReviewController,
    EnvironmentController,
    PromptsController,
    AgentsController,
    FilesystemController,
  ],
  providers: [
    // Agent providers
    ClaudeCodeProvider,
    OpenCodeProvider,
    AgentProviderRegistry,
    // Services
    BrainstormingService,
    DecompositionService,
    ExecutionService,
    ReviewService,
    EnvironmentService,
    SessionService,
    PromptsService,
    AgentsService,
    SessionGateway,
    EnvironmentGateway,
  ],
  exports: [BrainstormingService, DecompositionService, ExecutionService, ReviewService, EnvironmentService, SessionService, PromptsService, AgentsService],
})
export class ClaudeCodeAgentModule {}
