import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Subject, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface SessionCompletedEvent {
  session: {
    sessionId: string;
    status: string;
  };
}

export interface SessionOutputEvent {
  sessionId: string;
  line: string;
  timestamp: string;
}

export interface SessionTurnCompleteEvent {
  sessionId: string;
  timestamp: string;
}

export interface SessionPausedEvent {
  sessionId: string;
}

export interface SessionErrorEvent {
  sessionId: string;
  error: string;
}

/**
 * WebSocket service for session events.
 * Connects to the /sessions namespace and provides observables for session events.
 * Supports reconnection and pending subscription queues.
 */
@Injectable({
  providedIn: 'root',
})
export class SessionWebSocketService {
  private socket: Socket | null = null;
  private connected = false;

  // Track subscribed session IDs for re-subscription on reconnect
  private subscribedSessions = new Set<string>();

  // Queue for subscriptions requested before connection
  private pendingSubscriptions = new Set<string>();

  // Event subjects
  private sessionStartedSubject = new Subject<SessionCompletedEvent>();
  private sessionCompletedSubject = new Subject<SessionCompletedEvent>();
  private sessionOutputSubject = new Subject<SessionOutputEvent>();
  private sessionTurnCompleteSubject = new Subject<SessionTurnCompleteEvent>();
  private sessionPausedSubject = new Subject<SessionPausedEvent>();
  private sessionErrorSubject = new Subject<SessionErrorEvent>();

  // Public observables
  readonly onSessionStarted: Observable<SessionCompletedEvent> = this.sessionStartedSubject.asObservable();
  readonly onSessionCompleted: Observable<SessionCompletedEvent> = this.sessionCompletedSubject.asObservable();
  readonly onSessionOutput: Observable<SessionOutputEvent> = this.sessionOutputSubject.asObservable();
  readonly onSessionTurnComplete: Observable<SessionTurnCompleteEvent> = this.sessionTurnCompleteSubject.asObservable();
  readonly onSessionPaused: Observable<SessionPausedEvent> = this.sessionPausedSubject.asObservable();
  readonly onSessionError: Observable<SessionErrorEvent> = this.sessionErrorSubject.asObservable();

  connect(): void {
    if (this.connected) return;

    const wsUrl = environment.wsUrl;
    this.socket = io(`${wsUrl}/sessions`, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    this.socket.on('connect', () => {
      this.connected = true;
      console.log('Session WebSocket connected');

      // Re-subscribe to all tracked sessions
      for (const sessionId of this.subscribedSessions) {
        this.socket?.emit('subscribe', sessionId);
      }

      // Process pending subscriptions
      for (const sessionId of this.pendingSubscriptions) {
        this.socket?.emit('subscribe', sessionId);
        this.subscribedSessions.add(sessionId);
      }
      this.pendingSubscriptions.clear();
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      console.log('Session WebSocket disconnected');
    });

    // Listen for session events
    this.socket.on('session:started', (event: SessionCompletedEvent) => {
      this.sessionStartedSubject.next(event);
    });

    this.socket.on('session:completed', (event: SessionCompletedEvent) => {
      this.sessionCompletedSubject.next(event);
    });

    this.socket.on('session:output', (event: SessionOutputEvent) => {
      this.sessionOutputSubject.next(event);
    });

    this.socket.on('session:turn_complete', (event: SessionTurnCompleteEvent) => {
      this.sessionTurnCompleteSubject.next(event);
    });

    this.socket.on('session:paused', (event: SessionPausedEvent) => {
      this.sessionPausedSubject.next(event);
    });

    this.socket.on('session:error', (event: SessionErrorEvent) => {
      this.sessionErrorSubject.next(event);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  subscribeToSession(sessionId: string): void {
    this.subscribedSessions.add(sessionId);

    if (this.socket && this.connected) {
      this.socket.emit('subscribe', sessionId);
    } else {
      // Queue for when we connect
      this.pendingSubscriptions.add(sessionId);
    }
  }

  unsubscribeFromSession(sessionId: string): void {
    this.subscribedSessions.delete(sessionId);
    this.pendingSubscriptions.delete(sessionId);

    if (this.socket && this.connected) {
      this.socket.emit('unsubscribe', sessionId);
    }
  }
}
