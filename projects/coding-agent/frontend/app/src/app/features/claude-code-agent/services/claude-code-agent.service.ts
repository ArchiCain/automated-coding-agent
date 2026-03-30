import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface SessionMetadata {
  sessionId: string;
  cwd: string;
  status: 'active' | 'completed' | 'failed' | 'paused';
  model: string;
  startedAt: string;
  lastActivityAt: string;
  completedAt?: string;
  error?: string;
  title?: string;
  agentName?: string;
  agentSlug?: string;
  startedFromRoute?: string;
  planDir?: string;
  sdkSessionId?: string;
  conversational?: boolean;
}

export interface PersistedSession {
  metadata: SessionMetadata;
  transcript: string[];
}

export interface StartSessionOptions {
  model?: string;
  title?: string;
  agentName?: string;
  agentSlug?: string;
  startedFromRoute?: string;
  planDir?: string;
  conversational?: boolean;
  instructionsFile?: string;
  knowledgeFiles?: string[];
  provider?: string;
  readOnly?: boolean;
}

export interface UploadedAttachment {
  id: string;
  type: 'file' | 'image';
  name: string;
  path: string;
}

@Injectable({ providedIn: 'root' })
export class ClaudeCodeAgentService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  /**
   * Read a document's content
   */
  readDocument(path: string): Observable<{ content: string; isImage?: boolean; mimeType?: string }> {
    return this.http.get<{ content: string; isImage?: boolean; mimeType?: string }>(
      `${this.apiUrl}/api/claude-code-agent/files?path=${encodeURIComponent(path)}`
    );
  }

  /**
   * Get configuration (repo root, etc.)
   */
  getConfig(): Observable<{ repoRoot: string }> {
    return this.http.get<{ repoRoot: string }>(`${this.apiUrl}/api/claude-code-agent/config`);
  }

  /**
   * List all active sessions
   */
  listSessions(): Observable<{ sessions: SessionMetadata[] }> {
    return this.http.get<{ sessions: SessionMetadata[] }>(`${this.apiUrl}/api/claude-code-agent/sessions`);
  }

  /**
   * Start a new session
   */
  startSession(prompt: string, cwd: string, options?: StartSessionOptions): Observable<{ session: SessionMetadata }> {
    return this.http.post<{ session: SessionMetadata }>(`${this.apiUrl}/api/claude-code-agent/sessions`, {
      prompt,
      cwd,
      ...options,
    });
  }

  /**
   * Interrupt a running session
   */
  interruptSession(sessionId: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(
      `${this.apiUrl}/api/claude-code-agent/sessions/${sessionId}/interrupt`,
      {}
    );
  }

  /**
   * Send a message to an existing session
   */
  sendMessage(sessionId: string, message: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(
      `${this.apiUrl}/api/claude-code-agent/sessions/${sessionId}/message`,
      { message }
    );
  }

  /**
   * Get session with transcript (in-memory only)
   */
  getSession(sessionId: string): Observable<{ session: SessionMetadata | null; transcript: string[] }> {
    return this.http.get<{ session: SessionMetadata | null; transcript: string[] }>(
      `${this.apiUrl}/api/claude-code-agent/sessions/${sessionId}`
    );
  }

  /**
   * Get persisted session from disk
   */
  getPersistedSession(sessionId: string, planDir: string): Observable<{ session: PersistedSession | null }> {
    return this.http.get<{ session: PersistedSession | null }>(
      `${this.apiUrl}/api/claude-code-agent/sessions/${sessionId}/persisted?planDir=${encodeURIComponent(planDir)}`
    );
  }

  /**
   * Upload files as attachments
   */
  uploadFiles(files: File[]): Observable<{ attachments: UploadedAttachment[] }> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    return this.http.post<{ attachments: UploadedAttachment[] }>(
      `${this.apiUrl}/api/claude-code-agent/upload`,
      formData
    );
  }
}
