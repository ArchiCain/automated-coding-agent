import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/**
 * Session status
 */
export type SessionStatus = 'active' | 'paused' | 'completed' | 'failed';

/**
 * Session metadata
 */
export interface SessionMetadata {
  sessionId: string;
  cwd: string;
  status: SessionStatus;
  model: string;
  startedAt: string;
  lastActivityAt: string;
  completedAt?: string;
  error?: string;
  // Optional display info
  title?: string;
  agentId?: string;
  agentName?: string;
}

/**
 * Agent definition
 */
export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  promptFile: string | null;
  contextFiles: string[];
  instructions: string; // Quick-start tip shown in UI
  promptContent?: string;
}

@Injectable({ providedIn: 'root' })
export class AgentsService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8086/api/agents';

  // ========== Config API ==========

  /**
   * Get agent config (including repo root for default working directory)
   */
  getConfig(): Observable<{ repoRoot: string }> {
    return this.http.get<{ repoRoot: string }>(`${this.apiUrl}/config`);
  }

  // ========== Session API ==========

  /**
   * Start a new session
   */
  startSession(
    prompt: string,
    cwd: string,
    options?: {
      model?: string;
      linkTo?: string;
      linkDescription?: string;
    }
  ): Observable<{ session: SessionMetadata }> {
    return this.http.post<{ session: SessionMetadata }>(`${this.apiUrl}/sessions`, {
      prompt,
      cwd,
      ...options,
    });
  }

  /**
   * Resume an existing session
   */
  resumeSession(sessionId: string): Observable<{ session: SessionMetadata }> {
    return this.http.post<{ session: SessionMetadata }>(
      `${this.apiUrl}/sessions/${sessionId}/resume`,
      {}
    );
  }

  /**
   * Send a message to a session
   */
  sendMessage(sessionId: string, message: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(
      `${this.apiUrl}/sessions/${sessionId}/message`,
      { message }
    );
  }

  /**
   * Pause a session (keeps it resumable)
   */
  pauseSession(sessionId: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(
      `${this.apiUrl}/sessions/${sessionId}/pause`,
      {}
    );
  }

  /**
   * End a session (marks as completed)
   */
  endSession(sessionId: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(
      `${this.apiUrl}/sessions/${sessionId}`
    );
  }

  /**
   * Get session details
   */
  getSession(sessionId: string): Observable<{ session: SessionMetadata }> {
    return this.http.get<{ session: SessionMetadata }>(
      `${this.apiUrl}/sessions/${sessionId}`
    );
  }

  /**
   * Get full session details including transcript and prompt
   */
  getSessionFull(sessionId: string): Observable<{
    session: SessionMetadata;
    prompt: string;
    transcript: string[];
  }> {
    return this.http.get<{
      session: SessionMetadata;
      prompt: string;
      transcript: string[];
    }>(`${this.apiUrl}/sessions/${sessionId}/full`);
  }

  /**
   * List all sessions
   */
  listSessions(): Observable<{ sessions: SessionMetadata[] }> {
    return this.http.get<{ sessions: SessionMetadata[] }>(`${this.apiUrl}/sessions`);
  }

  /**
   * Get active sessions
   */
  getActiveSessions(): Observable<{ sessions: SessionMetadata[] }> {
    return this.http.get<{ sessions: SessionMetadata[] }>(`${this.apiUrl}/sessions/active`);
  }

  // ========== Agent Definitions API ==========

  /**
   * List all agent definitions
   */
  listDefinitions(category?: string): Observable<{ definitions: AgentDefinition[] }> {
    const url = category
      ? `${this.apiUrl}/definitions?category=${category}`
      : `${this.apiUrl}/definitions`;
    return this.http.get<{ definitions: AgentDefinition[] }>(url);
  }

  /**
   * Get a specific agent definition
   */
  getDefinition(id: string): Observable<{ definition: AgentDefinition }> {
    return this.http.get<{ definition: AgentDefinition }>(`${this.apiUrl}/definitions/${id}`);
  }

  /**
   * Read a file's content
   */
  readFile(path: string): Observable<{ content: string }> {
    return this.http.get<{ content: string }>(`${this.apiUrl}/files?path=${encodeURIComponent(path)}`);
  }

  /**
   * Run a predefined agent with an initial message
   */
  runAgent(
    agentId: string,
    message: string,
    options?: {
      cwd?: string;
      model?: string;
    }
  ): Observable<{ session: SessionMetadata }> {
    return this.http.post<{ session: SessionMetadata }>(
      `${this.apiUrl}/definitions/${agentId}/run`,
      { message, ...options }
    );
  }

  /**
   * Run a custom agent with files and prompt
   */
  runCustomAgent(
    prompt: string,
    options?: {
      files?: string[];
      cwd?: string;
      model?: string;
    }
  ): Observable<{ session: SessionMetadata }> {
    return this.http.post<{ session: SessionMetadata }>(`${this.apiUrl}/run`, {
      prompt,
      ...options,
    });
  }
}
