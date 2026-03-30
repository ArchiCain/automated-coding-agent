import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  RepoProject,
  ProjectFeature,
  FeatureConcern,
} from '../models/project.model';

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/projects`;

  listProjects(): Observable<RepoProject[]> {
    return this.http
      .get<{ projects: RepoProject[] }>(this.baseUrl)
      .pipe(
        map((res) =>
          res.projects.map((p) => ({
            ...p,
            readmePath: p.hasReadme ? `${p.path}/README.md` : undefined,
          })),
        ),
      );
  }

  getProject(projectId: string): Observable<RepoProject> {
    return this.http
      .get<{ project: RepoProject }>(`${this.baseUrl}/${projectId}`)
      .pipe(
        map((res) => ({
          ...res.project,
          readmePath: res.project.hasReadme ? `${res.project.path}/README.md` : undefined,
        })),
      );
  }

  listFeatures(projectId: string): Observable<ProjectFeature[]> {
    return this.http
      .get<{ features: ProjectFeature[] }>(
        `${this.baseUrl}/${projectId}/features`,
      )
      .pipe(map((res) => res.features));
  }

  getFeature(
    projectId: string,
    featureId: string,
  ): Observable<ProjectFeature> {
    return this.http
      .get<{ feature: ProjectFeature }>(
        `${this.baseUrl}/${projectId}/features/${featureId}`,
      )
      .pipe(map((res) => res.feature));
  }

  listConcerns(
    projectId: string,
    featureId: string,
  ): Observable<FeatureConcern[]> {
    return this.http
      .get<{ concerns: FeatureConcern[] }>(
        `${this.baseUrl}/${projectId}/features/${featureId}/concerns`,
      )
      .pipe(map((res) => res.concerns));
  }
}
