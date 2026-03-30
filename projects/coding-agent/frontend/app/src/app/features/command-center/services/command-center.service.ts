import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface CommandCenterConfig {
  baseBranch: string;
  lastUpdated: string;
}

export interface GitStatus {
  branch: string;
  clean: boolean;
  staged: number;
  ahead: number;
  behind: number;
}

/**
 * Service for Command Center operations.
 */
@Injectable({
  providedIn: 'root',
})
export class CommandCenterService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/command-center`;

  /**
   * Get current configuration
   */
  getConfig(): Observable<CommandCenterConfig> {
    return this.http
      .get<{ config: CommandCenterConfig }>(`${this.baseUrl}/config`)
      .pipe(map((res) => res.config));
  }

  /**
   * Set the base branch
   */
  setBaseBranch(branch: string): Observable<CommandCenterConfig> {
    return this.http
      .post<{ config: CommandCenterConfig }>(`${this.baseUrl}/config/base-branch`, {
        branch,
      })
      .pipe(map((res) => res.config));
  }

  /**
   * Get current git branch
   */
  getCurrentBranch(): Observable<string> {
    return this.http
      .get<{ branch: string }>(`${this.baseUrl}/git/current-branch`)
      .pipe(map((res) => res.branch));
  }

  /**
   * List all branches
   */
  listBranches(query?: string): Observable<string[]> {
    const params: Record<string, string> = {};
    if (query) {
      params['query'] = query;
    }
    return this.http
      .get<{ branches: string[] }>(`${this.baseUrl}/git/branches`, { params })
      .pipe(map((res) => res.branches));
  }

  /**
   * Get docker status for all services
   */
  getDockerStatus(): Observable<Record<string, { state: string; health: string | null }>> {
    return this.http.get<Record<string, { state: string; health: string | null }>>(
      `${this.baseUrl}/docker/status`
    );
  }

  /**
   * Switch to a branch
   */
  switchBranch(branch: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.baseUrl}/git/switch`,
      { branch }
    );
  }

  /**
   * Get git status
   */
  getGitStatus(): Observable<GitStatus> {
    return this.http.get<GitStatus>(`${this.baseUrl}/git/status`);
  }
}
