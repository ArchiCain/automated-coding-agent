import { Controller, Get, Param } from '@nestjs/common';
import { ProjectsService } from '../services/projects.service';
import {
  RepoProject,
  ProjectFeature,
  FeatureConcern,
} from '../models/project.model';

@Controller('api/projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  async listProjects(): Promise<{ projects: RepoProject[] }> {
    const projects = await this.projectsService.listProjects();
    return { projects };
  }

  @Get(':projectId')
  async getProject(
    @Param('projectId') projectId: string,
  ): Promise<{ project: RepoProject }> {
    const project = await this.projectsService.getProject(projectId);
    return { project };
  }

  @Get(':projectId/features')
  async listFeatures(
    @Param('projectId') projectId: string,
  ): Promise<{ features: ProjectFeature[] }> {
    const features = await this.projectsService.listFeatures(projectId);
    return { features };
  }

  @Get(':projectId/features/:featureId')
  async getFeature(
    @Param('projectId') projectId: string,
    @Param('featureId') featureId: string,
  ): Promise<{ feature: ProjectFeature }> {
    const feature = await this.projectsService.getFeature(
      projectId,
      featureId,
    );
    return { feature };
  }

  @Get(':projectId/features/:featureId/concerns')
  async listConcerns(
    @Param('projectId') projectId: string,
    @Param('featureId') featureId: string,
  ): Promise<{ concerns: FeatureConcern[] }> {
    const concerns = await this.projectsService.listConcerns(
      projectId,
      featureId,
    );
    return { concerns };
  }
}
