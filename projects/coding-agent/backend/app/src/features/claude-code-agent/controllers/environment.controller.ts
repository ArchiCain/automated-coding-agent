import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  EnvironmentService,
  EnvironmentState,
} from '../services/environment.service';

@Controller('api/environment')
export class EnvironmentController {
  constructor(private readonly environmentService: EnvironmentService) {}

  @Post(':planId/setup')
  async setup(
    @Param('planId') planId: string,
  ): Promise<{ environment: EnvironmentState }> {
    if (!planId) {
      throw new HttpException('Plan ID is required', HttpStatus.BAD_REQUEST);
    }
    try {
      const environment = await this.environmentService.setup(planId);
      return { environment };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to setup environment',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':planId/status')
  async getStatus(
    @Param('planId') planId: string,
  ): Promise<{ environment: EnvironmentState }> {
    const environment = await this.environmentService.getStatus(planId);
    if (!environment) {
      throw new HttpException(
        'No environment found for this plan',
        HttpStatus.NOT_FOUND,
      );
    }
    return { environment };
  }

  @Post(':planId/stop')
  async stop(
    @Param('planId') planId: string,
  ): Promise<{ environment: EnvironmentState }> {
    try {
      const environment = await this.environmentService.stop(planId);
      return { environment };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to stop environment',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':planId/start')
  async start(
    @Param('planId') planId: string,
  ): Promise<{ environment: EnvironmentState }> {
    try {
      const environment = await this.environmentService.start(planId);
      return { environment };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to start environment',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':planId/restart')
  async restart(
    @Param('planId') planId: string,
  ): Promise<{ environment: EnvironmentState }> {
    try {
      const environment = await this.environmentService.restart(planId);
      return { environment };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to restart environment',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':planId/purge-and-restart')
  async purgeAndRestart(
    @Param('planId') planId: string,
  ): Promise<{ environment: EnvironmentState }> {
    try {
      const environment = await this.environmentService.purgeAndRestart(planId);
      return { environment };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to purge and restart environment',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':planId/logs')
  async getLogs(
    @Param('planId') planId: string,
    @Query('tail') tail?: string,
  ): Promise<{ logs: string }> {
    try {
      const logs = await this.environmentService.getLogs(
        planId,
        tail ? parseInt(tail, 10) : 200,
      );
      return { logs };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get logs',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':planId/health')
  async healthCheck(
    @Param('planId') planId: string,
  ): Promise<{ services: Array<{ name: string; healthy: boolean; detail: string }> }> {
    try {
      return await this.environmentService.healthCheck(planId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to run health checks',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':planId/containers')
  async getContainerStatus(
    @Param('planId') planId: string,
  ): Promise<{ output: string }> {
    try {
      const output = await this.environmentService.getContainerStatus(planId);
      return { output };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get container status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ── Per-service endpoints ──

  @Get(':planId/services')
  async getServiceStatuses(
    @Param('planId') planId: string,
  ): Promise<{ services: Array<{ name: string; state: string; status: string; ports: string }> }> {
    try {
      const services = await this.environmentService.getServiceStatuses(planId);
      return { services };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get service statuses',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':planId/services/:service/stop')
  async stopService(
    @Param('planId') planId: string,
    @Param('service') service: string,
  ): Promise<{ ok: true }> {
    try {
      await this.environmentService.stopService(planId, service);
      return { ok: true };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to stop service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':planId/services/:service/start')
  async startService(
    @Param('planId') planId: string,
    @Param('service') service: string,
  ): Promise<{ ok: true }> {
    try {
      await this.environmentService.startService(planId, service);
      return { ok: true };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to start service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':planId/services/:service/restart')
  async restartService(
    @Param('planId') planId: string,
    @Param('service') service: string,
  ): Promise<{ ok: true }> {
    try {
      await this.environmentService.restartService(planId, service);
      return { ok: true };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to restart service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':planId/services/:service/rebuild')
  async rebuildService(
    @Param('planId') planId: string,
    @Param('service') service: string,
  ): Promise<{ ok: true }> {
    try {
      await this.environmentService.rebuildService(planId, service);
      return { ok: true };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to rebuild service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':planId/services/:service/logs')
  async getServiceLogs(
    @Param('planId') planId: string,
    @Param('service') service: string,
    @Query('tail') tail?: string,
  ): Promise<{ logs: string }> {
    try {
      const logs = await this.environmentService.getServiceLogs(
        planId,
        service,
        tail ? parseInt(tail, 10) : 200,
      );
      return { logs };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get service logs',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':planId/services/:service/health')
  async healthCheckService(
    @Param('planId') planId: string,
    @Param('service') service: string,
  ): Promise<{ healthy: boolean; detail: string }> {
    try {
      return await this.environmentService.healthCheckService(planId, service);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to check service health',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':planId')
  async teardown(
    @Param('planId') planId: string,
  ): Promise<{ environment: EnvironmentState }> {
    try {
      const environment = await this.environmentService.teardown(planId);
      return { environment };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to teardown environment',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
