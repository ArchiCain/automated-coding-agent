import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { io, Socket } from 'socket.io-client';

import { AppConfigService } from '@features/api-client';

import { ChatSession, ChatMessage, SessionHistory } from '../types';
import { ChatApiService } from './chat.api';

/** Manages chat state and Socket.IO connection to the agent backend. */
@Injectable({ providedIn: 'root' })
export class ChatService implements OnDestroy {
  private readonly config = inject(AppConfigService);
  private readonly chatApi = inject(ChatApiService);

  private socket: Socket | null = null;
  private subscriptions: Subscription[] = [];

  readonly sessions = signal<ChatSession[]>([]);
  readonly activeSession = signal<ChatSession | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly systemPrompt = signal<string>('');
  readonly isStreaming = signal(false);

  connect(): void {
    if (this.socket) return;

    this.socket = io(`${this.config.backendUrl}/agent`, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    this.socket.on('agent:history', (history: SessionHistory) => {
      this.systemPrompt.set(history.systemPrompt);
      this.messages.set(history.messages);
    });

    this.socket.on('agent:message', (message: ChatMessage) => {
      this.messages.update(msgs => [...msgs, message]);
    });

    this.socket.on('agent:done', () => {
      this.isStreaming.set(false);
    });

    this.socket.on('agent:error', (error: { message: string }) => {
      this.messages.update(msgs => [...msgs, { type: 'error', content: error.message }]);
      this.isStreaming.set(false);
    });
  }

  loadSessions(): void {
    this.chatApi.getSessions().subscribe(sessions => {
      this.sessions.set(sessions);
      if (sessions.length > 0 && !this.activeSession()) {
        this.selectSession(sessions[0]!);
      }
    });
  }

  selectSession(session: ChatSession): void {
    this.activeSession.set(session);
    this.messages.set([]);
    this.systemPrompt.set('');
    this.socket?.emit('join:session', { sessionId: session.id });
  }

  createSession(role?: string): void {
    this.chatApi.createSession(undefined, role).subscribe(session => {
      this.sessions.update(s => [session, ...s]);
      this.selectSession(session);
    });
  }

  deleteSession(session: ChatSession): void {
    this.chatApi.deleteSession(session.id).subscribe(() => {
      this.sessions.update(s => s.filter(x => x.id !== session.id));
      if (this.activeSession()?.id === session.id) {
        const remaining = this.sessions();
        this.activeSession.set(remaining.length > 0 ? remaining[0]! : null);
        if (remaining.length > 0) {
          this.selectSession(remaining[0]!);
        }
      }
    });
  }

  sendMessage(content: string): void {
    const session = this.activeSession();
    if (!session || !this.socket) return;

    this.messages.update(msgs => [...msgs, { type: 'user', content }]);
    this.isStreaming.set(true);
    this.socket.emit('message', { sessionId: session.id, message: content });
  }

  cancelMessage(): void {
    const session = this.activeSession();
    if (!session || !this.socket) return;
    this.socket.emit('cancel', { sessionId: session.id });
    this.isStreaming.set(false);
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.subscriptions.forEach(s => s.unsubscribe());
  }
}
