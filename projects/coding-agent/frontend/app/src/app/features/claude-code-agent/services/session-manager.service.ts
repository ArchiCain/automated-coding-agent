import { Injectable, OnDestroy, computed, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { ClaudeCodeAgentService, SessionMetadata } from './claude-code-agent.service';
import { SessionWebSocketService } from './session-websocket.service';

const STORAGE_KEY = 'coding-agent-sessions';

/**
 * Tracked session with transcript output
 */
export interface TrackedSession {
  metadata: SessionMetadata;
  output: string[];
}

/**
 * Global session manager for tracking agent sessions across navigation.
 * Uses signals for reactive state management and persists session IDs
 * to localStorage for reconnection on page reload.
 * Follows the TaskService pattern.
 */
@Injectable({
  providedIn: 'root',
})
export class SessionManagerService implements OnDestroy {
  private subscriptions: Subscription[] = [];
  private initialized = false;

  // Sessions state
  private sessionsSignal = signal<TrackedSession[]>([]);

  // Dock expansion state
  private expandedIdSignal = signal<string | null>(null);

  // Cross-component communication: request to open an agent panel
  private requestOpenAgentSignal = signal<{ slug: string; route: string } | null>(null);
  readonly requestOpenAgent = this.requestOpenAgentSignal.asReadonly();

  // Public computed signals
  readonly sessions = this.sessionsSignal.asReadonly();
  readonly expandedId = this.expandedIdSignal.asReadonly();

  readonly activeSessions = computed(() =>
    this.sessionsSignal().filter((s) => s.metadata.status === 'active')
  );

  readonly activeCount = computed(() => this.activeSessions().length);

  readonly completedSessions = computed(() =>
    this.sessionsSignal().filter(
      (s) => s.metadata.status === 'completed' || s.metadata.status === 'failed'
    )
  );

  readonly hasDock = computed(() => this.sessionsSignal().length > 0);

  readonly expandedSession = computed(() => {
    const id = this.expandedIdSignal();
    if (!id) return null;
    return this.sessionsSignal().find((s) => s.metadata.sessionId === id) || null;
  });

  constructor(
    private agentService: ClaudeCodeAgentService,
    private wsService: SessionWebSocketService,
  ) {
    this.initialize();
  }

  private initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Connect to WebSocket
    this.wsService.connect();

    // Subscribe to WebSocket events
    this.subscriptions.push(
      this.wsService.onSessionOutput.subscribe((event) => {
        this.appendOutput(event.sessionId, event.line);
        this.updateSessionField(event.sessionId, { status: 'active' });
      }),
      this.wsService.onSessionTurnComplete.subscribe((event) => {
        this.updateSessionField(event.sessionId, { status: 'paused' });
      }),
      this.wsService.onSessionPaused.subscribe((event) => {
        this.updateSessionField(event.sessionId, { status: 'paused' });
      }),
      this.wsService.onSessionCompleted.subscribe((event) => {
        this.updateSessionField(event.session.sessionId, {
          status: event.session.status as SessionMetadata['status'],
          completedAt: new Date().toISOString(),
        });
      }),
      this.wsService.onSessionError.subscribe((event) => {
        this.updateSessionField(event.sessionId, {
          status: 'failed',
          error: event.error,
        });
      }),
    );

    // Reconnect to persisted sessions
    this.reconnectPersistedSessions();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  /**
   * Track a new session (call this when starting a session)
   */
  trackSession(metadata: SessionMetadata): void {
    // Don't add duplicates
    const existing = this.sessionsSignal().find(
      (s) => s.metadata.sessionId === metadata.sessionId
    );
    if (existing) return;

    const tracked: TrackedSession = {
      metadata,
      output: [],
    };

    this.sessionsSignal.update((sessions) => [tracked, ...sessions]);
    this.persistSessionIds();

    // Subscribe to WS events for this session
    this.wsService.subscribeToSession(metadata.sessionId);
  }

  /**
   * Interrupt a running session
   */
  interruptSession(sessionId: string): void {
    this.agentService.interruptSession(sessionId).subscribe({
      next: () => {
        this.updateSessionField(sessionId, { status: 'paused' });
      },
      error: (err) => {
        console.error('Failed to interrupt session:', err);
      },
    });
  }

  /**
   * Dismiss a session from the tracker
   */
  dismissSession(sessionId: string): void {
    if (this.expandedIdSignal() === sessionId) {
      this.collapse();
    }
    this.wsService.unsubscribeFromSession(sessionId);
    this.sessionsSignal.update((sessions) =>
      sessions.filter((s) => s.metadata.sessionId !== sessionId)
    );
    this.persistSessionIds();
  }

  /**
   * Clear all completed/failed sessions
   */
  clearCompleted(): void {
    const completed = this.completedSessions();
    for (const session of completed) {
      this.dismissSession(session.metadata.sessionId);
    }
  }

  /**
   * Expand a session in the dock
   */
  expand(sessionId: string): void {
    this.expandedIdSignal.set(sessionId);
  }

  /**
   * Collapse the expanded session
   */
  collapse(): void {
    this.expandedIdSignal.set(null);
  }

  /**
   * Toggle expansion
   */
  toggle(sessionId: string): void {
    if (this.expandedIdSignal() === sessionId) {
      this.collapse();
    } else {
      this.expand(sessionId);
    }
  }

  /**
   * Get a tracked session by ID
   */
  getSession(sessionId: string): TrackedSession | null {
    return this.sessionsSignal().find((s) => s.metadata.sessionId === sessionId) || null;
  }

  /**
   * Request the chatbot widget to navigate to a page and open an agent panel
   */
  requestOpenAgentPanel(slug: string, route: string): void {
    this.requestOpenAgentSignal.set({ slug, route });
  }

  /**
   * Clear the open agent request after it's been handled
   */
  clearOpenAgentRequest(): void {
    this.requestOpenAgentSignal.set(null);
  }

  // Private helpers

  private appendOutput(sessionId: string, line: string): void {
    this.sessionsSignal.update((sessions) =>
      sessions.map((s) =>
        s.metadata.sessionId === sessionId
          ? { ...s, output: [...s.output, line] }
          : s
      )
    );
  }

  private updateSessionField(
    sessionId: string,
    fields: Partial<SessionMetadata>
  ): void {
    this.sessionsSignal.update((sessions) =>
      sessions.map((s) =>
        s.metadata.sessionId === sessionId
          ? { ...s, metadata: { ...s.metadata, ...fields } }
          : s
      )
    );
    this.persistSessionIds();
  }

  private persistSessionIds(): void {
    const ids = this.sessionsSignal().map((s) => s.metadata.sessionId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  }

  private getPersistedSessionIds(): string[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private reconnectPersistedSessions(): void {
    const ids = this.getPersistedSessionIds();
    if (ids.length === 0) return;

    // Fetch each session's current state from the server
    for (const sessionId of ids) {
      this.agentService.getSession(sessionId).subscribe({
        next: (response) => {
          if (response.session) {
            const tracked: TrackedSession = {
              metadata: response.session,
              output: response.transcript || [],
            };

            this.sessionsSignal.update((sessions) => {
              // Don't add duplicates
              if (sessions.some((s) => s.metadata.sessionId === sessionId)) {
                return sessions;
              }
              return [...sessions, tracked];
            });

            // Re-subscribe to WS events
            this.wsService.subscribeToSession(sessionId);
          }
        },
        error: () => {
          // Session no longer exists on server - remove from persisted
          this.sessionsSignal.update((sessions) =>
            sessions.filter((s) => s.metadata.sessionId !== sessionId)
          );
          this.persistSessionIds();
        },
      });
    }
  }
}
