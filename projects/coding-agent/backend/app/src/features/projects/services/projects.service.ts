import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  RepoProject,
  ProjectType,
  ProjectFeature,
  FeatureConcern,
  ConcernType,
} from '../models/project.model';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);
  private readonly repoRoot: string;

  constructor() {
    this.repoRoot = process.env.REPO_ROOT || path.resolve(__dirname, '../../../../../../../../');
  }

  async listProjects(): Promise<RepoProject[]> {
    const projects: RepoProject[] = [];
    const projectsDir = path.join(this.repoRoot, 'projects');

    // Scan projects/
    const topEntries = await this.safeReadDir(projectsDir);
    for (const entry of topEntries) {
      const fullPath = path.join(projectsDir, entry);
      if (await this.isDirectory(fullPath)) {
        const project = await this.buildProject(entry, path.join('projects', entry));
        if (project) projects.push(project);
      }
    }

    return projects.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getProject(projectId: string): Promise<RepoProject> {
    const relativePath = this.resolveProjectPath(projectId);
    if (!relativePath) {
      throw new NotFoundException(`Project not found: ${projectId}`);
    }

    const project = await this.buildProject(projectId, relativePath);
    if (!project) {
      throw new NotFoundException(`Project not found: ${projectId}`);
    }

    return project;
  }

  async listFeatures(projectId: string): Promise<ProjectFeature[]> {
    const relativePath = this.resolveProjectPath(projectId);
    if (!relativePath) {
      throw new NotFoundException(`Project not found: ${projectId}`);
    }

    const projectType = await this.detectProjectType(
      path.join(this.repoRoot, relativePath),
    );
    const featuresDir = this.getFeaturesDir(relativePath, projectType);
    const fullFeaturesDir = path.join(this.repoRoot, featuresDir);

    const entries = await this.safeReadDir(fullFeaturesDir);
    const features: ProjectFeature[] = [];

    for (const entry of entries) {
      const featurePath = path.join(fullFeaturesDir, entry);
      if (await this.isDirectory(featurePath)) {
        const feature = await this.buildFeature(
          entry,
          path.join(featuresDir, entry),
          featurePath,
        );
        features.push(feature);
      }
    }

    return features.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getFeature(
    projectId: string,
    featureId: string,
  ): Promise<ProjectFeature> {
    const features = await this.listFeatures(projectId);
    const feature = features.find((f) => f.id === featureId);
    if (!feature) {
      throw new NotFoundException(
        `Feature not found: ${featureId} in project ${projectId}`,
      );
    }
    return feature;
  }

  async listConcerns(
    projectId: string,
    featureId: string,
  ): Promise<FeatureConcern[]> {
    const feature = await this.getFeature(projectId, featureId);
    return feature.concerns;
  }

  // Private helpers

  private resolveProjectPath(projectId: string): string | null {
    const candidates = [
      path.join('projects', projectId),
    ];

    for (const candidate of candidates) {
      const fullPath = path.join(this.repoRoot, candidate);
      try {
        // Sync check since we need this for path resolution
        const stat = require('fs').statSync(fullPath);
        if (stat.isDirectory()) return candidate;
      } catch {
        // Not found, continue
      }
    }

    return null;
  }

  private async buildProject(
    id: string,
    relativePath: string,
  ): Promise<RepoProject | null> {
    const fullPath = path.join(this.repoRoot, relativePath);

    try {
      const projectType = await this.detectProjectType(fullPath);
      const description = await this.readFirstParagraph(
        path.join(fullPath, 'README.md'),
      );
      const port = this.getDefaultPort(id, projectType);
      const hasDocker = await this.fileExists(
        path.join(fullPath, 'docker-compose.yml'),
      );
      const hasReadme = await this.fileExists(
        path.join(fullPath, 'README.md'),
      );

      // Count features
      const featuresDir = this.getFeaturesDir(relativePath, projectType);
      const fullFeaturesDir = path.join(this.repoRoot, featuresDir);
      const featureEntries = await this.safeReadDir(fullFeaturesDir);
      let featureCount = 0;
      for (const entry of featureEntries) {
        if (await this.isDirectory(path.join(fullFeaturesDir, entry))) {
          featureCount++;
        }
      }

      return {
        id,
        name: this.formatProjectName(id),
        path: relativePath,
        type: projectType,
        port,
        description,
        featureCount,
        hasDocker,
        hasReadme,
        techBadge: this.getTechBadge(projectType),
      };
    } catch (error) {
      this.logger.warn(`Failed to build project ${id}: ${error.message}`);
      return null;
    }
  }

  private async buildFeature(
    id: string,
    relativePath: string,
    fullPath: string,
  ): Promise<ProjectFeature> {
    const hasModule = await this.hasFilePattern(fullPath, '.module.ts');
    const hasIndex = await this.fileExists(path.join(fullPath, 'index.ts'));
    const hasReadme = await this.fileExists(path.join(fullPath, 'README.md'));
    const description = hasReadme
      ? await this.readFirstParagraph(path.join(fullPath, 'README.md'))
      : undefined;

    const concerns = await this.scanConcerns(fullPath);

    return {
      id,
      name: this.formatFeatureName(id),
      path: relativePath,
      description,
      concernCount: concerns.length,
      concerns,
      hasModule,
      hasIndex,
      hasReadme,
    };
  }

  private async scanConcerns(featurePath: string): Promise<FeatureConcern[]> {
    const concerns: FeatureConcern[] = [];
    await this.scanConcernsRecursive(featurePath, featurePath, concerns);
    return concerns.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
  }

  private async scanConcernsRecursive(
    basePath: string,
    currentPath: string,
    concerns: FeatureConcern[],
  ): Promise<void> {
    const entries = await this.safeReadDir(currentPath);

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry);

      if (await this.isDirectory(fullPath)) {
        await this.scanConcernsRecursive(basePath, fullPath, concerns);
        continue;
      }

      // Skip spec files, declaration files, and non-source files
      if (entry.endsWith('.spec.ts') || entry.endsWith('.d.ts')) {
        continue;
      }

      const concernType = this.classifyConcern(entry);
      if (!concernType) continue;

      const relativeName = path.relative(basePath, fullPath);

      concerns.push({
        id: entry.replace(/\.[^.]+$/, ''),
        name: this.formatConcernName(entry, concernType),
        type: concernType,
        fileName: relativeName,
      });
    }
  }

  private classifyConcern(fileName: string): ConcernType | null {
    const name = fileName.toLowerCase();

    // TypeScript files
    if (name.endsWith('.controller.ts')) return 'controller';
    if (name.endsWith('.service.ts')) return 'service';
    if (name.endsWith('.entity.ts')) return 'entity';
    if (name.endsWith('.dto.ts')) return 'dto';
    if (name.endsWith('.gateway.ts')) return 'gateway';
    if (name.endsWith('.guard.ts')) return 'guard';
    if (name.endsWith('.decorator.ts')) return 'decorator';
    if (name.endsWith('.middleware.ts')) return 'middleware';
    if (name.endsWith('.component.ts')) return 'component';
    if (name.endsWith('.page.ts')) return 'page';
    if (name.endsWith('.pipe.ts')) return 'pipe';
    if (name.endsWith('.model.ts')) return 'model';
    if (name.endsWith('.module.ts')) return 'module';
    if (name === 'index.ts') return 'index';
    if (name.endsWith('.config.ts') || name.endsWith('-config.ts')) return 'config';
    if (name.endsWith('.spec.ts')) return 'spec';
    if (name.endsWith('.ts')) return 'other';

    // Template & style files
    if (name.endsWith('.html')) return 'template';
    if (name.endsWith('.scss') || name.endsWith('.css')) return 'style';

    // Data files
    if (name.endsWith('.json')) return 'json';
    if (name.endsWith('.md')) return 'markdown';
    if (name.endsWith('.yml') || name.endsWith('.yaml')) return 'yaml';

    // Skip everything else (images, binaries, etc.)
    return null;
  }

  private async detectProjectType(projectPath: string): Promise<ProjectType> {
    // Check for angular.json
    if (await this.fileExists(path.join(projectPath, 'app', 'angular.json'))) {
      return 'angular';
    }

    // Check package.json for clues
    try {
      const pkgPath = path.join(projectPath, 'app', 'package.json');
      const content = await fs.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(content);
      const deps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      if (deps['@nestjs/core']) return 'nestjs';
      if (deps['@angular/core']) return 'angular';
      if (deps['react']) return 'react';
      if (deps['@playwright/test']) return 'playwright';
    } catch {
      // No package.json in app/
    }

    // Check for docker-compose with postgres
    try {
      const dcPath = path.join(projectPath, 'docker-compose.yml');
      const content = await fs.readFile(dcPath, 'utf-8');
      if (content.includes('postgres')) return 'postgres';
      if (content.includes('keycloak')) return 'keycloak';
    } catch {
      // No docker-compose
    }

    return 'other';
  }

  private getFeaturesDir(
    relativePath: string,
    projectType: ProjectType,
  ): string {
    if (projectType === 'angular') {
      return path.join(relativePath, 'app', 'src', 'app', 'features');
    }
    return path.join(relativePath, 'app', 'src', 'features');
  }

  private formatProjectName(id: string): string {
    return id
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  private formatFeatureName(id: string): string {
    return id
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  private formatConcernName(fileName: string, type: ConcernType): string {
    // Remove file extension
    const base = fileName
      .replace(/\.(ts|html|scss|css|json|md|yml|yaml)$/, '')
      .replace(new RegExp(`\\.${type}$`), '');
    return base
      .split(/[-.]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  private getDefaultPort(
    id: string,
    type: ProjectType,
  ): number | undefined {
    const portMap: Record<string, number> = {
      backend: 8085,
      frontend: 3000,
      database: 5437,
      keycloak: 8081,
      e2e: undefined as any,
      'coding-agent-backend': 8086,
      'coding-agent-frontend': 4200,
    };
    return portMap[id];
  }

  private getTechBadge(type: ProjectType): string {
    const badges: Record<ProjectType, string> = {
      nestjs: 'NestJS',
      angular: 'Angular 19',
      react: 'React',
      postgres: 'PostgreSQL',
      keycloak: 'Keycloak',
      playwright: 'Playwright',
      other: 'Other',
    };
    return badges[type];
  }

  private async readFirstParagraph(
    filePath: string,
  ): Promise<string | undefined> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      // Skip title (# ...) and blank lines, find first paragraph
      let paragraphLines: string[] = [];
      let foundContent = false;

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#')) continue;
        if (!trimmed) {
          if (foundContent) break;
          continue;
        }
        foundContent = true;
        paragraphLines.push(trimmed);
      }

      return paragraphLines.length > 0
        ? paragraphLines.join(' ').slice(0, 200)
        : undefined;
    } catch {
      return undefined;
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async isDirectory(filePath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(filePath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  private async safeReadDir(dirPath: string): Promise<string[]> {
    try {
      return await fs.readdir(dirPath);
    } catch {
      return [];
    }
  }

  private async hasFilePattern(
    dirPath: string,
    pattern: string,
  ): Promise<boolean> {
    const entries = await this.safeReadDir(dirPath);
    return entries.some((e) => e.endsWith(pattern));
  }
}
