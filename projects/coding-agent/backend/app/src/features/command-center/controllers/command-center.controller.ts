import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { CommandCenterService, CommandCenterConfig, DockerServiceStatus } from '../services/command-center.service';

@Controller('api/command-center')
export class CommandCenterController {
  constructor(private readonly commandCenterService: CommandCenterService) {}

  /**
   * Get current configuration
   */
  @Get('config')
  async getConfig(): Promise<{ config: CommandCenterConfig }> {
    const config = await this.commandCenterService.getConfig();
    return { config };
  }

  /**
   * Set the base branch
   */
  @Post('config/base-branch')
  async setBaseBranch(
    @Body() body: { branch: string }
  ): Promise<{ config: CommandCenterConfig }> {
    const config = await this.commandCenterService.setBaseBranch(body.branch);
    return { config };
  }

  /**
   * Get current git branch
   */
  @Get('git/current-branch')
  async getCurrentBranch(): Promise<{ branch: string }> {
    const branch = await this.commandCenterService.getCurrentBranch();
    return { branch };
  }

  /**
   * List all branches
   */
  @Get('git/branches')
  async listBranches(
    @Query('query') query?: string
  ): Promise<{ branches: string[] }> {
    const branches = await this.commandCenterService.listBranches(query);
    return { branches };
  }

  /**
   * Switch to a branch
   */
  @Post('git/switch')
  async switchBranch(
    @Body() body: { branch: string }
  ): Promise<{ success: boolean; message: string }> {
    return await this.commandCenterService.switchBranch(body.branch);
  }

  /**
   * Get git status
   */
  @Get('git/status')
  async getGitStatus(): Promise<{
    branch: string;
    clean: boolean;
    ahead: number;
    behind: number;
  }> {
    return await this.commandCenterService.getGitStatus();
  }

  /**
   * Get Docker container status
   * Returns a map of service ID to status
   */
  @Get('docker/status')
  async getDockerStatus(): Promise<Record<string, { state: string; health: string | null }>> {
    const containers = await this.commandCenterService.getDockerStatus();

    // Transform array to map keyed by service name (lowercase)
    const statusMap: Record<string, { state: string; health: string | null }> = {};
    for (const container of containers) {
      // Use the Service field as the key (docker-compose service name)
      const serviceId = container.Service?.toLowerCase();
      if (serviceId) {
        statusMap[serviceId] = {
          state: container.State?.toLowerCase() || 'unknown',
          health: container.Health?.toLowerCase() || null,
        };
      }
    }

    return statusMap;
  }
}
