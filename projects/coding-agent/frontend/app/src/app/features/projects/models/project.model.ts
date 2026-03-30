export interface RepoProject {
  id: string;
  name: string;
  path: string;
  type: ProjectType;
  port?: number;
  description?: string;
  featureCount: number;
  hasDocker: boolean;
  hasReadme: boolean;
  readmePath?: string;
  techBadge: string;
}

export type ProjectType =
  | 'nestjs'
  | 'angular'
  | 'react'
  | 'postgres'
  | 'keycloak'
  | 'playwright'
  | 'other';

export interface ProjectFeature {
  id: string;
  name: string;
  path: string;
  description?: string;
  concernCount: number;
  concerns: FeatureConcern[];
  hasModule: boolean;
  hasIndex: boolean;
  hasReadme: boolean;
}

export interface FeatureConcern {
  id: string;
  name: string;
  type: ConcernType;
  fileName: string;
}

export type ConcernType =
  | 'controller'
  | 'service'
  | 'entity'
  | 'dto'
  | 'gateway'
  | 'guard'
  | 'decorator'
  | 'middleware'
  | 'component'
  | 'page'
  | 'pipe'
  | 'model'
  | 'module'
  | 'index'
  | 'config'
  | 'spec'
  | 'template'
  | 'style'
  | 'json'
  | 'markdown'
  | 'yaml'
  | 'other';
