import { Injectable, inject } from '@angular/core';
import { Observable, of, catchError, map } from 'rxjs';
import { ClaudeCodeAgentService } from '../../claude-code-agent/services/claude-code-agent.service';
import { SessionManagerService } from '../../claude-code-agent/services/session-manager.service';
import { SessionWebSocketService } from '../../claude-code-agent/services/session-websocket.service';

const STORAGE_KEY = 'chatbot-scoped-sessions';

@Injectable({ providedIn: 'root' })
export class ScopedSessionService {
  private agentService = inject(ClaudeCodeAgentService);
  private sessionManager = inject(SessionManagerService);
  private wsService = inject(SessionWebSocketService);

  private getMapping(): Record<string, string> {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  private saveMapping(mapping: Record<string, string>): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mapping));
  }

  getSessionForScope(scopeKey: string): string | null {
    return this.getMapping()[scopeKey] || null;
  }

  registerSession(scopeKey: string, sessionId: string): void {
    const mapping = this.getMapping();
    mapping[scopeKey] = sessionId;
    this.saveMapping(mapping);
  }

  clearSession(scopeKey: string): void {
    const mapping = this.getMapping();
    delete mapping[scopeKey];
    this.saveMapping(mapping);
  }

  resumeSession(
    scopeKey: string,
  ): Observable<{ sessionId: string; transcript: string[] } | null> {
    const sessionId = this.getSessionForScope(scopeKey);
    if (!sessionId) {
      return of(null);
    }

    return this.agentService.getSession(sessionId).pipe(
      map((response) => {
        if (response.session) {
          // Re-track in session manager and subscribe to WS
          this.sessionManager.trackSession(response.session);
          this.wsService.subscribeToSession(sessionId);
          return {
            sessionId,
            transcript: response.transcript || [],
          };
        }
        // Session no longer exists on server
        this.clearSession(scopeKey);
        return null;
      }),
      catchError(() => {
        this.clearSession(scopeKey);
        return of(null);
      }),
    );
  }
}
