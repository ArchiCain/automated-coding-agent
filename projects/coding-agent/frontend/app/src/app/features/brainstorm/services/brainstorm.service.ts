import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Agent, AgentDocument } from '../../claude-code-agent/models/agent.model';
import { environment } from '../../../../environments/environment';

/**
 * Brainstorming session metadata
 */
export interface BrainstormingMeta {
  planId: string;
  planName: string;
  agentSessionId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Brainstorming session with agent state
 */
export interface BrainstormingSession {
  agent: Agent;
  meta: BrainstormingMeta;
}

/**
 * Brainstorming config from backend
 */
export interface BrainstormingConfig {
  promptFile: string;
  contextFiles: string[];
}

@Injectable({
  providedIn: 'root',
})
export class BrainstormService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/brainstorming`;

  /**
   * Get all brainstorming sessions
   */
  listSessions(): Observable<BrainstormingSession[]> {
    return this.http
      .get<{ sessions: BrainstormingSession[] }>(`${this.baseUrl}/sessions`)
      .pipe(map((res) => res.sessions));
  }

  /**
   * Create a new brainstorming session
   */
  createSession(name?: string): Observable<BrainstormingSession> {
    return this.http
      .post<{ session: BrainstormingSession }>(`${this.baseUrl}/sessions`, {
        name: name || '',
      })
      .pipe(map((res) => res.session));
  }

  /**
   * Get a specific brainstorming session
   */
  getSession(planId: string): Observable<BrainstormingSession> {
    return this.http
      .get<{ session: BrainstormingSession }>(
        `${this.baseUrl}/sessions/${planId}`,
      )
      .pipe(map((res) => res.session));
  }

  /**
   * Update a brainstorming session's name
   */
  updateSessionName(
    planId: string,
    name: string,
  ): Observable<BrainstormingSession> {
    return this.http
      .patch<{ session: BrainstormingSession }>(
        `${this.baseUrl}/sessions/${planId}`,
        { name },
      )
      .pipe(map((res) => res.session));
  }

  /**
   * Link a Claude Code agent session to a brainstorming session
   */
  linkAgentSession(planId: string, agentSessionId: string): Observable<void> {
    return this.http
      .post<{ success: boolean }>(`${this.baseUrl}/sessions/${planId}/link`, {
        agentSessionId,
      })
      .pipe(map(() => undefined));
  }

  /**
   * Delete a brainstorming session
   */
  deleteSession(planId: string): Observable<void> {
    return this.http
      .delete<{ success: boolean }>(`${this.baseUrl}/sessions/${planId}`)
      .pipe(map(() => undefined));
  }

  /**
   * Get the brainstorming config (prompt file, context files)
   */
  getConfig(): Observable<BrainstormingConfig> {
    return this.http.get<BrainstormingConfig>(`${this.baseUrl}/config`);
  }

  /**
   * Convert a brainstorming session to an Agent for the AgentCard component
   */
  sessionToAgent(session: BrainstormingSession): Agent {
    // The agent state from the backend already has most of what we need
    // We just need to ensure it has all the required fields
    return {
      ...session.agent,
      // Ensure instructions are set for the pre-session state
      instructions:
        session.agent.instructions ||
        'Start a conversation to brainstorm your project plan',
    };
  }
}
