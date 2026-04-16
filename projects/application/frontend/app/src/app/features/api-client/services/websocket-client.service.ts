import { Injectable, inject, OnDestroy } from '@angular/core';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';

import { AppConfigService } from './app-config.service';

@Injectable({ providedIn: 'root' })
export class WebSocketClientService implements OnDestroy {
  private readonly config = inject(AppConfigService);
  private socket: Socket | null = null;

  connect(namespace: string): void {
    if (this.socket) {
      this.disconnect();
    }

    this.socket = io(`${this.config.backendUrl}/${namespace}`, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
  }

  on<T>(event: string): Observable<T> {
    return new Observable<T>(subscriber => {
      if (!this.socket) {
        subscriber.error(new Error('WebSocket not connected'));
        return;
      }

      const handler = (data: T): void => subscriber.next(data);
      this.socket.on(event, handler);

      return () => {
        this.socket?.off(event, handler);
      };
    });
  }

  emit(event: string, data: unknown): void {
    if (!this.socket) {
      throw new Error('WebSocket not connected');
    }
    this.socket.emit(event, data);
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
