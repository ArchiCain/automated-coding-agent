import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Subject, Observable } from 'rxjs';
import { SessionMetadata } from './agents.service';

/**
 * Session WebSocket events
 */
export interface SessionStartedEvent {
  type: 'session:started';
  session: SessionMetadata;
}

export interface SessionResumedEvent {
  type: 'session:resumed';
  session: SessionMetadata;
}

export interface SessionOutputEvent {
  type: 'session:output';
  sessionId: string;
  line: string;
  timestamp: string;
}

export interface SessionTurnCompleteEvent {
  type: 'session:turn_complete';
  sessionId: string;
  timestamp: string;
}

export interface SessionPausedEvent {
  type: 'session:paused';
  sessionId: string;
}

export interface SessionCompletedEvent {
  type: 'session:completed';
  session: SessionMetadata;
}

export interface SessionErrorEvent {
  type: 'session:error';
  sessionId: string;
  error: string;
}

export type SessionEvent =
  | SessionStartedEvent
  | SessionResumedEvent
  | SessionOutputEvent
  | SessionTurnCompleteEvent
  | SessionPausedEvent
  | SessionCompletedEvent
  | SessionErrorEvent;

@Injectable({ providedIn: 'root' })
export class AgentsWebSocketService implements OnDestroy {
  private socket: Socket | null = null;
  private wsUrl = 'http://localhost:8086/agents';
  private _isConnected = false;

  // Event subjects
  private sessionStarted$ = new Subject<SessionStartedEvent>();
  private sessionResumed$ = new Subject<SessionResumedEvent>();
  private sessionOutput$ = new Subject<SessionOutputEvent>();
  private sessionTurnComplete$ = new Subject<SessionTurnCompleteEvent>();
  private sessionPaused$ = new Subject<SessionPausedEvent>();
  private sessionCompleted$ = new Subject<SessionCompletedEvent>();
  private sessionError$ = new Subject<SessionErrorEvent>();
  private allEvents$ = new Subject<SessionEvent>();

  // Connection state
  private connected$ = new Subject<boolean>();

  // Queue for subscription requests before connection
  private pendingSubscriptions: Array<() => void> = [];

  /**
   * Connect to the WebSocket server
   */
  connect(): void {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io(this.wsUrl, {
      transports: ['websocket'],
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      console.log('Session WebSocket connected');
      this._isConnected = true;
      this.connected$.next(true);

      // Process any pending subscriptions
      this.pendingSubscriptions.forEach((sub) => sub());
      this.pendingSubscriptions = [];
    });

    this.socket.on('disconnect', () => {
      console.log('Session WebSocket disconnected');
      this._isConnected = false;
      this.connected$.next(false);
    });

    // Session events
    this.socket.on('session:started', (event: SessionStartedEvent) => {
      this.sessionStarted$.next(event);
      this.allEvents$.next(event);
    });

    this.socket.on('session:resumed', (event: SessionResumedEvent) => {
      this.sessionResumed$.next(event);
      this.allEvents$.next(event);
    });

    this.socket.on('session:output', (event: SessionOutputEvent) => {
      this.sessionOutput$.next(event);
      this.allEvents$.next(event);
    });

    this.socket.on('session:turn_complete', (event: SessionTurnCompleteEvent) => {
      this.sessionTurnComplete$.next(event);
      this.allEvents$.next(event);
    });

    this.socket.on('session:paused', (event: SessionPausedEvent) => {
      this.sessionPaused$.next(event);
      this.allEvents$.next(event);
    });

    this.socket.on('session:completed', (event: SessionCompletedEvent) => {
      this.sessionCompleted$.next(event);
      this.allEvents$.next(event);
    });

    this.socket.on('session:error', (event: SessionErrorEvent) => {
      this.sessionError$.next(event);
      this.allEvents$.next(event);
    });
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Execute a subscription action, queueing it if not connected
   */
  private executeOrQueue(action: () => void): void {
    if (this._isConnected && this.socket) {
      action();
    } else {
      this.pendingSubscriptions.push(action);
    }
  }

  /**
   * Subscribe to a specific session's events
   */
  subscribeToSession(sessionId: string): void {
    this.executeOrQueue(() => {
      this.socket?.emit('subscribe:session', { sessionId });
    });
  }

  /**
   * Unsubscribe from a session's events
   */
  unsubscribeFromSession(sessionId: string): void {
    this.executeOrQueue(() => {
      this.socket?.emit('unsubscribe:session', { sessionId });
    });
  }

  /**
   * Subscribe to all session events (for dashboard/header)
   */
  subscribeToAll(): void {
    this.executeOrQueue(() => {
      this.socket?.emit('subscribe:all');
    });
  }

  /**
   * Unsubscribe from all session events
   */
  unsubscribeFromAll(): void {
    this.executeOrQueue(() => {
      this.socket?.emit('unsubscribe:all');
    });
  }

  // Observable getters
  get onSessionStarted(): Observable<SessionStartedEvent> {
    return this.sessionStarted$.asObservable();
  }

  get onSessionResumed(): Observable<SessionResumedEvent> {
    return this.sessionResumed$.asObservable();
  }

  get onSessionOutput(): Observable<SessionOutputEvent> {
    return this.sessionOutput$.asObservable();
  }

  get onSessionTurnComplete(): Observable<SessionTurnCompleteEvent> {
    return this.sessionTurnComplete$.asObservable();
  }

  get onSessionPaused(): Observable<SessionPausedEvent> {
    return this.sessionPaused$.asObservable();
  }

  get onSessionCompleted(): Observable<SessionCompletedEvent> {
    return this.sessionCompleted$.asObservable();
  }

  get onSessionError(): Observable<SessionErrorEvent> {
    return this.sessionError$.asObservable();
  }

  get onAllEvents(): Observable<SessionEvent> {
    return this.allEvents$.asObservable();
  }

  get onConnectionChange(): Observable<boolean> {
    return this.connected$.asObservable();
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.sessionStarted$.complete();
    this.sessionResumed$.complete();
    this.sessionOutput$.complete();
    this.sessionTurnComplete$.complete();
    this.sessionPaused$.complete();
    this.sessionCompleted$.complete();
    this.sessionError$.complete();
    this.allEvents$.complete();
    this.connected$.complete();
  }
}
