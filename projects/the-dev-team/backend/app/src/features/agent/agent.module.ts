import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { AgentGateway } from './agent.gateway';
import { GitHubTokenService } from './github-token.service';
import { ClaudeCodeProvider } from './providers/claude-code.provider';
import { OpenCodeProvider } from './providers/opencode.provider';
import { ProviderRegistry } from './providers/provider-registry';

@Module({
  controllers: [AgentController],
  providers: [
    AgentService,
    AgentGateway,
    GitHubTokenService,
    ClaudeCodeProvider,
    OpenCodeProvider,
    ProviderRegistry,
  ],
  exports: [AgentService],
})
export class AgentModule {}
