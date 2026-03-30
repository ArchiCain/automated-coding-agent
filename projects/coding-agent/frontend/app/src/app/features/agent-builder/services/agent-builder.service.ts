import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  AgentConfig,
  CreateAgentConfigDto,
  UpdateAgentConfigDto,
  FileEntry,
  PromptInfo,
} from '../models/agent-config.model';

@Injectable({ providedIn: 'root' })
export class AgentBuilderService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  // Agent CRUD
  listAgents(): Observable<AgentConfig[]> {
    return this.http
      .get<{ agents: AgentConfig[] }>(`${this.apiUrl}/api/agents`)
      .pipe(map((r) => r.agents));
  }

  getAgent(id: string): Observable<AgentConfig> {
    return this.http
      .get<{ agent: AgentConfig }>(`${this.apiUrl}/api/agents/${id}`)
      .pipe(map((r) => r.agent));
  }

  createAgent(dto: CreateAgentConfigDto): Observable<AgentConfig> {
    return this.http
      .post<{ agent: AgentConfig }>(`${this.apiUrl}/api/agents`, dto)
      .pipe(map((r) => r.agent));
  }

  updateAgent(id: string, dto: UpdateAgentConfigDto): Observable<AgentConfig> {
    return this.http
      .put<{ agent: AgentConfig }>(`${this.apiUrl}/api/agents/${id}`, dto)
      .pipe(map((r) => r.agent));
  }

  deleteAgent(id: string): Observable<void> {
    return this.http
      .delete<{ success: boolean }>(`${this.apiUrl}/api/agents/${id}`)
      .pipe(map(() => undefined));
  }

  // Session transcript
  getAgentSessionTranscript(slug: string, sessionId: string): Observable<{ transcript: string[] }> {
    return this.http.get<{ transcript: string[] }>(
      `${this.apiUrl}/api/agents/${slug}/sessions/${sessionId}/transcript`,
    );
  }

  // Agent instructions
  readAgentInstructions(slug: string): Observable<string> {
    return this.http
      .get<{ content: string }>(`${this.apiUrl}/api/agents/${slug}/instructions`)
      .pipe(map((r) => r.content));
  }

  writeAgentInstructions(slug: string, content: string): Observable<void> {
    return this.http
      .put<{ success: boolean }>(`${this.apiUrl}/api/agents/${slug}/instructions`, { content })
      .pipe(map(() => undefined));
  }

  // Filesystem browsing
  browse(dirPath?: string): Observable<{ entries: FileEntry[]; currentPath: string }> {
    const params = dirPath ? `?path=${encodeURIComponent(dirPath)}` : '';
    return this.http.get<{ entries: FileEntry[]; currentPath: string }>(
      `${this.apiUrl}/api/filesystem/browse${params}`,
    );
  }

  // Prompt CRUD
  listPrompts(): Observable<PromptInfo[]> {
    return this.http
      .get<{ prompts: PromptInfo[] }>(`${this.apiUrl}/api/prompts`)
      .pipe(map((r) => r.prompts));
  }

  readPrompt(filename: string): Observable<string> {
    return this.http
      .get<{ content: string }>(`${this.apiUrl}/api/prompts/${encodeURIComponent(filename)}`)
      .pipe(map((r) => r.content));
  }

  createPrompt(filename: string, content: string): Observable<void> {
    return this.http
      .post<{ success: boolean }>(`${this.apiUrl}/api/prompts`, { filename, content })
      .pipe(map(() => undefined));
  }

  updatePrompt(filename: string, content: string): Observable<void> {
    return this.http
      .put<{ success: boolean }>(`${this.apiUrl}/api/prompts/${encodeURIComponent(filename)}`, { content })
      .pipe(map(() => undefined));
  }

  // Provider listing
  listProviders(): Observable<{ name: string; available: boolean }[]> {
    return this.http
      .get<{ providers: { name: string; available: boolean }[] }>(`${this.apiUrl}/api/claude-code-agent/providers`)
      .pipe(map((r) => r.providers));
  }
}
