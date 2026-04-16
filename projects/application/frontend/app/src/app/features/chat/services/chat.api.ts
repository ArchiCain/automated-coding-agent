import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { AppConfigService } from '@features/api-client';

import { ChatSession } from '../types';

@Injectable({ providedIn: 'root' })
export class ChatApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  private get baseUrl(): string {
    return `${this.config.backendUrl}/agent`;
  }

  getSessions(): Observable<ChatSession[]> {
    return this.http.get<ChatSession[]>(`${this.baseUrl}/sessions`, { withCredentials: true });
  }

  createSession(model?: string, role?: string): Observable<ChatSession> {
    return this.http.post<ChatSession>(
      `${this.baseUrl}/sessions`,
      { model, role },
      { withCredentials: true },
    );
  }

  deleteSession(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/sessions/${id}`, { withCredentials: true });
  }
}
