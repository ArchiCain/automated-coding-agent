import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Agent } from '../../claude-code-agent/models/agent.model';
import { environment } from '../../../../environments/environment';

/**
 * Plan info for decomposition
 */
export interface PlanInfo {
  id: string;
  name: string;
  path: string;
  status: string;
  hasBeenDecomposed: boolean;
  taskCount: number;
}

/**
 * Decomposition session metadata (ephemeral, no persistence)
 */
export interface DecompositionMeta {
  sessionId: string;
  planId: string;
  planName: string;
  planPath: string;
  inputFile: string;
  outputBase: string;
  parentId: string;
  decompType: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Decomposition session with agent state
 */
export interface DecompositionSession {
  agent: Agent;
  meta: DecompositionMeta;
}

/**
 * Decomposition type definition
 */
export interface DecompType {
  id: string;
  name: string;
  description: string;
}

/**
 * Task in the tasks tree
 */
export interface TaskNode {
  slug: string;
  name: string;
  status: string;
  path: string;
  depth: number;
  children: TaskNode[];
}

/**
 * Existing task info for prompt injection
 */
export interface ExistingTask {
  name: string;
  path: string;
  status: string;
}

/**
 * Task info for listing in decomposition pages
 */
export interface TaskInfo {
  id: string;
  planId: string;
  slug: string;
  name: string;
  path: string;
  taskPath: string;
  status: string;
  hasBeenDecomposed: boolean;
  childCount: number;
}

@Injectable({
  providedIn: 'root',
})
export class DecompositionService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/decomposition`;

  /**
   * Get all plans available for decomposition
   */
  listPlans(): Observable<PlanInfo[]> {
    return this.http
      .get<{ plans: PlanInfo[] }>(`${this.baseUrl}/plans`)
      .pipe(map((res) => res.plans));
  }

  /**
   * Get a specific plan's info
   */
  getPlanInfo(planId: string): Observable<PlanInfo> {
    return this.http
      .get<{ plan: PlanInfo }>(`${this.baseUrl}/plans/${planId}`)
      .pipe(map((res) => res.plan));
  }

  /**
   * Update a plan's ready status
   */
  updatePlanReady(planId: string, ready: boolean): Observable<void> {
    return this.http
      .patch<{ success: boolean }>(`${this.baseUrl}/plans/${planId}/ready`, { ready })
      .pipe(map(() => undefined));
  }

  /**
   * Update a task's ready status
   */
  updateTaskReady(planId: string, taskSlug: string, ready: boolean): Observable<void> {
    return this.http
      .patch<{ success: boolean }>(`${this.baseUrl}/plans/${planId}/tasks/${taskSlug}/ready`, { ready })
      .pipe(map(() => undefined));
  }

  /**
   * Get tasks tree for a plan
   */
  getTasksTree(planId: string): Observable<TaskNode[]> {
    return this.http
      .get<{ tasks: TaskNode[] }>(`${this.baseUrl}/plans/${planId}/tasks`)
      .pipe(map((res) => res.tasks));
  }

  /**
   * Get tasks from a specific directory (outputBase)
   */
  getTasksFromDirectory(directory: string): Observable<TaskNode[]> {
    return this.http
      .post<{ tasks: TaskNode[] }>(`${this.baseUrl}/tasks-from-directory`, { directory })
      .pipe(map((res) => res.tasks));
  }

  /**
   * Get existing tasks for a plan (for prompt injection)
   */
  getExistingTasks(planId: string): Observable<ExistingTask[]> {
    return this.http
      .get<{ tasks: ExistingTask[] }>(`${this.baseUrl}/plans/${planId}/existing-tasks`)
      .pipe(map((res) => res.tasks));
  }

  /**
   * Get available decomposition types
   */
  getDecompTypes(): Observable<DecompType[]> {
    return this.http
      .get<{ types: DecompType[] }>(`${this.baseUrl}/types`)
      .pipe(map((res) => res.types));
  }

  /**
   * List all project-level tasks (for Project to Features page)
   */
  listProjectTasks(): Observable<TaskInfo[]> {
    return this.http
      .get<{ tasks: TaskInfo[] }>(`${this.baseUrl}/project-tasks`)
      .pipe(map((res) => res.tasks));
  }

  /**
   * List all feature-level tasks (for Feature to Concerns page)
   */
  listFeatureTasks(): Observable<TaskInfo[]> {
    return this.http
      .get<{ tasks: TaskInfo[] }>(`${this.baseUrl}/feature-tasks`)
      .pipe(map((res) => res.tasks));
  }

  /**
   * Create a new decomposition session (ephemeral, in-memory only)
   */
  createSession(
    planId: string,
    decompType: string,
  ): Observable<DecompositionSession> {
    return this.http
      .post<{ session: DecompositionSession }>(`${this.baseUrl}/sessions`, {
        planId,
        decompType,
      })
      .pipe(map((res) => res.session));
  }

  /**
   * Get a specific decomposition session (in-memory only)
   */
  getSession(sessionId: string): Observable<DecompositionSession> {
    return this.http
      .get<{ session: DecompositionSession }>(
        `${this.baseUrl}/sessions/${sessionId}`,
      )
      .pipe(map((res) => res.session));
  }

  /**
   * Create a decomposition session for a task (project or feature)
   */
  createTaskSession(
    taskId: string,
    decompType: string,
  ): Observable<DecompositionSession> {
    return this.http
      .post<{ session: DecompositionSession }>(`${this.baseUrl}/task-sessions`, {
        taskId,
        decompType,
      })
      .pipe(map((res) => res.session));
  }

  /**
   * Convert a decomposition session to an Agent for the AgentCard component
   */
  sessionToAgent(session: DecompositionSession): Agent {
    return {
      ...session.agent,
      instructions:
        session.agent.instructions ||
        'Start the decomposition to break down the plan into tasks',
    };
  }
}
