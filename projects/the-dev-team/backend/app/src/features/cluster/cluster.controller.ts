import { Controller, Get, Param, Query } from '@nestjs/common';
import { ClusterService } from './cluster.service';

@Controller('cluster')
export class ClusterController {
  constructor(private readonly clusterService: ClusterService) {}

  @Get('pods')
  async getPods(@Query('namespace') namespace?: string) {
    return this.clusterService.getPods(namespace);
  }

  @Get('services')
  async getServices(@Query('namespace') namespace?: string) {
    return this.clusterService.getServices(namespace);
  }

  @Get('metrics')
  async getMetrics() {
    return this.clusterService.getMetrics();
  }

  @Get('namespaces')
  async getNamespaces() {
    return this.clusterService.getNamespaces();
  }

  @Get('logs/:namespace/:pod')
  async getLogs(
    @Param('namespace') namespace: string,
    @Param('pod') pod: string,
    @Query('tail') tail?: string,
  ) {
    return this.clusterService.getLogs(namespace, pod, parseInt(tail || '200', 10));
  }
}
