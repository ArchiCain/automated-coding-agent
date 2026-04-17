import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
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

  @Get('info')
  async getInfo() {
    const branch = await this.clusterService.getBranch();
    return { branch };
  }

  @Get('logs/:namespace/:pod')
  async getLogs(
    @Param('namespace') namespace: string,
    @Param('pod') pod: string,
    @Query('tail') tail?: string,
  ) {
    return this.clusterService.getLogs(namespace, pod, parseInt(tail || '200', 10));
  }

  @Get('prometheus/query')
  async prometheusQuery(
    @Query('query') query: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('step') step?: string,
  ) {
    return this.clusterService.queryPrometheus(query, start, end, step);
  }

  @Get('loki/query')
  async lokiQuery(
    @Query('query') query: string,
    @Query('limit') limit?: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    return this.clusterService.queryLoki(query, parseInt(limit || '100', 10), start, end);
  }

  @Get('grafana/dashboards')
  async grafanaDashboards() {
    return this.clusterService.getGrafanaDashboards();
  }

  @Get('grafana/url')
  async grafanaUrl() {
    return { url: this.clusterService.getGrafanaUrl() };
  }

  @Get('docs')
  async listDocs(@Query('path') subpath?: string) {
    return this.clusterService.listDocs(subpath || '');
  }

  @Get('docs/read')
  async readDoc(@Query('path') filePath: string) {
    const content = await this.clusterService.readDoc(filePath);
    if (content === null) return { error: 'Not found' };
    return { content };
  }

  // ── Project docs (configurable root) ───────────────────────────

  @Get('project-docs/tree')
  async projectDocsTree(@Query('root') root: string) {
    return this.clusterService.getProjectDocsTree(root);
  }

  @Get('project-docs/read')
  async readProjectDoc(@Query('root') root: string, @Query('path') filePath: string) {
    const content = await this.clusterService.readProjectDoc(root, filePath);
    if (content === null) return { error: 'Not found' };
    return { content };
  }

  @Post('project-docs/write')
  async writeProjectDoc(@Body() body: { root: string; path: string; content: string }) {
    const ok = await this.clusterService.writeProjectDoc(body.root, body.path, body.content);
    if (!ok) return { error: 'Write failed' };
    return { ok: true };
  }
}
