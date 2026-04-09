import { Module } from '@nestjs/common';
import { GitService } from './git.service';
import { TaskfileService } from './taskfile.service';
import { HelmService } from './helm.service';
import { DockerService } from './docker.service';
import { GitHubTokenService } from './github-token.service';

@Module({
  providers: [GitService, TaskfileService, HelmService, DockerService, GitHubTokenService],
  exports: [GitService, TaskfileService, HelmService, DockerService, GitHubTokenService],
})
export class SharedModule {}
