import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  TaskStatus,
  TaskStatusFile,
  ProjectTask,
  FeatureTask,
  ConcernTask,
  ResetResult,
} from '../models/plan.model';
import { environment } from '../../../../environments/environment';
import { Agent } from '../../claude-code-agent/models/agent.model';

/**
 * Execution session metadata
 */
export interface ExecutionMeta {
  sessionId: string;
  planId: string;
  taskName: string;
  taskPath: string;
  taskMdPath: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Execution session with agent state
 */
export interface ExecutionSession {
  agent: Agent;
  meta: ExecutionMeta;
}

/**
 * Environment step state
 */
export interface EnvironmentStepState {
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  detail: string;
}

/**
 * Environment setup state for a plan
 */
export interface EnvironmentState {
  index: number;
  worktreePath: string;
  branch: string;
  ports: {
    backend: number;
    frontend: number;
    database: number;
    keycloak: number;
  };
  composeProjectName: string;
  steps: {
    worktree: EnvironmentStepState;
    docker: EnvironmentStepState;
  };
  status: 'setting_up' | 'ready' | 'stopped' | 'error' | 'torn_down';
}

/**
 * Docker service status from compose ps
 */
export interface ServiceStatus {
  name: string;
  state: string;
  status: string;
  ports: string;
}

/**
 * Review session metadata
 */
export interface ReviewMeta {
  sessionId: string;
  planId: string;
  taskName: string;
  taskPath: string;
  taskMdPath: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Review session with agent state
 */
export interface ReviewSession {
  agent: Agent;
  meta: ReviewMeta;
}

@Injectable({ providedIn: 'root' })
export class BacklogService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/api/execution`;
  private reviewUrl = `${environment.apiUrl}/api/review`;
  private decompUrl = `${environment.apiUrl}/api/decomposition`;
  private envUrl = `${environment.apiUrl}/api/environment`;

  // ============================================
  // Task listing methods (use decomposition API)
  // ============================================

  getProjectTasks(planId: string): Observable<{ projects: ProjectTask[] }> {
    return this.http.get<{ projects: ProjectTask[] }>(`${this.decompUrl}/plans/${planId}/project-tasks`);
  }

  getFeatureTasks(planId: string, projectPath: string): Observable<{ features: FeatureTask[] }> {
    const encodedPath = encodeURIComponent(projectPath);
    return this.http.get<{ features: FeatureTask[] }>(
      `${this.decompUrl}/plans/${planId}/projects/${encodedPath}/features`
    );
  }

  getConcernTasks(
    planId: string,
    projectPath: string,
    featureName: string
  ): Observable<{ concerns: ConcernTask[] }> {
    const encodedPath = encodeURIComponent(projectPath);
    return this.http.get<{ concerns: ConcernTask[] }>(
      `${this.decompUrl}/plans/${planId}/projects/${encodedPath}/features/${featureName}/concerns`
    );
  }

  // ============================================
  // Task status methods (use decomposition API)
  // ============================================

  updateTaskStatus(planId: string, taskPath: string, status: TaskStatus): Observable<TaskStatusFile> {
    const encodedPath = encodeURIComponent(taskPath);
    return this.http.put<TaskStatusFile>(`${this.decompUrl}/plans/${planId}/task-status/${encodedPath}`, {
      status,
    });
  }

  // ============================================
  // Reset methods (use decomposition API)
  // ============================================

  resetProjectDecomposition(planId: string, projectPath: string): Observable<ResetResult> {
    const encodedPath = encodeURIComponent(projectPath);
    return this.http.delete<ResetResult>(
      `${this.decompUrl}/plans/${planId}/projects/${encodedPath}/features`
    );
  }

  resetFeatureDecomposition(
    planId: string,
    projectPath: string,
    featureName: string
  ): Observable<ResetResult> {
    const encodedPath = encodeURIComponent(projectPath);
    return this.http.delete<ResetResult>(
      `${this.decompUrl}/plans/${planId}/projects/${encodedPath}/features/${featureName}/concerns`
    );
  }

  // ============================================
  // Execution session methods
  // ============================================

  /**
   * Create a new execution session for a task
   * @param planId The plan ID
   * @param taskPath The relative task path (e.g., "backend" or "backend/features/auth")
   */
  createExecutionSession(planId: string, taskPath: string): Observable<ExecutionSession> {
    return this.http
      .post<{ session: ExecutionSession }>(`${this.apiUrl}/sessions`, {
        planId,
        taskPath,
      })
      .pipe(map((res) => res.session));
  }

  /**
   * Get an existing execution session
   */
  getExecutionSession(sessionId: string): Observable<ExecutionSession> {
    return this.http
      .get<{ session: ExecutionSession }>(`${this.apiUrl}/sessions/${sessionId}`)
      .pipe(map((res) => res.session));
  }

  // ============================================
  // Review session methods
  // ============================================

  /**
   * Create a new review session for a task
   */
  createReviewSession(planId: string, taskPath: string): Observable<ReviewSession> {
    return this.http
      .post<{ session: ReviewSession }>(`${this.reviewUrl}/sessions`, {
        planId,
        taskPath,
      })
      .pipe(map((res) => res.session));
  }

  /**
   * Get an existing review session
   */
  getReviewSession(sessionId: string): Observable<ReviewSession> {
    return this.http
      .get<{ session: ReviewSession }>(`${this.reviewUrl}/sessions/${sessionId}`)
      .pipe(map((res) => res.session));
  }

  // ============================================
  // Environment methods
  // ============================================

  setupEnvironment(planId: string): Observable<EnvironmentState> {
    return this.http
      .post<{ environment: EnvironmentState }>(`${this.envUrl}/${planId}/setup`, {})
      .pipe(map((res) => res.environment));
  }

  getEnvironmentStatus(planId: string): Observable<EnvironmentState> {
    return this.http
      .get<{ environment: EnvironmentState }>(`${this.envUrl}/${planId}/status`)
      .pipe(map((res) => res.environment));
  }

  teardownEnvironment(planId: string): Observable<EnvironmentState> {
    return this.http
      .delete<{ environment: EnvironmentState }>(`${this.envUrl}/${planId}`)
      .pipe(map((res) => res.environment));
  }

  stopEnvironment(planId: string): Observable<EnvironmentState> {
    return this.http
      .post<{ environment: EnvironmentState }>(`${this.envUrl}/${planId}/stop`, {})
      .pipe(map((res) => res.environment));
  }

  startEnvironment(planId: string): Observable<EnvironmentState> {
    return this.http
      .post<{ environment: EnvironmentState }>(`${this.envUrl}/${planId}/start`, {})
      .pipe(map((res) => res.environment));
  }

  restartEnvironment(planId: string): Observable<EnvironmentState> {
    return this.http
      .post<{ environment: EnvironmentState }>(`${this.envUrl}/${planId}/restart`, {})
      .pipe(map((res) => res.environment));
  }

  purgeAndRestartEnvironment(planId: string): Observable<EnvironmentState> {
    return this.http
      .post<{ environment: EnvironmentState }>(`${this.envUrl}/${planId}/purge-and-restart`, {})
      .pipe(map((res) => res.environment));
  }

  getEnvironmentLogs(planId: string, tail: number = 200): Observable<string> {
    return this.http
      .get<{ logs: string }>(`${this.envUrl}/${planId}/logs`, { params: { tail: tail.toString() } })
      .pipe(map((res) => res.logs));
  }

  getEnvironmentHealth(planId: string): Observable<{ services: Array<{ name: string; healthy: boolean; detail: string }> }> {
    return this.http.get<{ services: Array<{ name: string; healthy: boolean; detail: string }> }>(
      `${this.envUrl}/${planId}/health`
    );
  }

  getContainerStatus(planId: string): Observable<string> {
    return this.http
      .get<{ output: string }>(`${this.envUrl}/${planId}/containers`)
      .pipe(map((res) => res.output));
  }

  // ============================================
  // Per-service methods
  // ============================================

  getServiceStatuses(planId: string): Observable<ServiceStatus[]> {
    return this.http
      .get<{ services: ServiceStatus[] }>(`${this.envUrl}/${planId}/services`)
      .pipe(map((res) => res.services));
  }

  stopService(planId: string, service: string): Observable<void> {
    return this.http
      .post<{ ok: true }>(`${this.envUrl}/${planId}/services/${service}/stop`, {})
      .pipe(map(() => undefined));
  }

  startService(planId: string, service: string): Observable<void> {
    return this.http
      .post<{ ok: true }>(`${this.envUrl}/${planId}/services/${service}/start`, {})
      .pipe(map(() => undefined));
  }

  restartService(planId: string, service: string): Observable<void> {
    return this.http
      .post<{ ok: true }>(`${this.envUrl}/${planId}/services/${service}/restart`, {})
      .pipe(map(() => undefined));
  }

  rebuildService(planId: string, service: string): Observable<void> {
    return this.http
      .post<{ ok: true }>(`${this.envUrl}/${planId}/services/${service}/rebuild`, {})
      .pipe(map(() => undefined));
  }

  getServiceLogs(planId: string, service: string, tail: number = 200): Observable<string> {
    return this.http
      .get<{ logs: string }>(`${this.envUrl}/${planId}/services/${service}/logs`, {
        params: { tail: tail.toString() },
      })
      .pipe(map((res) => res.logs));
  }

  healthCheckService(planId: string, service: string): Observable<{ healthy: boolean; detail: string }> {
    return this.http.get<{ healthy: boolean; detail: string }>(
      `${this.envUrl}/${planId}/services/${service}/health`
    );
  }

  /**
   * Convert an execution session to an Agent for the AgentCard component
   */
  sessionToAgent(session: ExecutionSession): Agent {
    return {
      ...session.agent,
      instructions:
        session.agent.instructions ||
        'Start execution to implement this task',
    };
  }
}
