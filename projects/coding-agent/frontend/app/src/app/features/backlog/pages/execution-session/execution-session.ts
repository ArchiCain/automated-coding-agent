import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription, interval } from 'rxjs';
import { MarkdownComponent } from 'ngx-markdown';
import { BacklogService, ExecutionSession } from '../../services/backlog.service';
import { Agent, AgentDocument } from '../../../claude-code-agent/models/agent.model';
import { AgentCardComponent } from '../../../claude-code-agent/components/agent-card/agent-card';
import { ClaudeCodeAgentService } from '../../../claude-code-agent/services/claude-code-agent.service';
import { SlideOverComponent } from '../../../ui-components';

@Component({
  selector: 'app-execution-session',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MarkdownComponent,
    AgentCardComponent,
    SlideOverComponent,
  ],
  templateUrl: './execution-session.html',
  styleUrl: './execution-session.scss',
})
export class ExecutionSessionComponent implements OnInit, OnDestroy {
  @ViewChild('agentCard') agentCard!: AgentCardComponent;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private backlogService = inject(BacklogService);
  private agentService = inject(ClaudeCodeAgentService);

  private subscriptions: Subscription[] = [];
  private sessionId: string = '';

  // Session data
  session = signal<ExecutionSession | null>(null);
  agent = signal<Agent | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  // Task content (task.md being executed)
  taskContent = signal<string>('');
  taskLoading = signal(true);

  // File slide-over state
  viewingDocument = signal<AgentDocument | null>(null);
  documentContent = signal<string>('');
  documentLoading = signal(false);

  // Track if agent has been started
  agentStarted = signal(false);

  ngOnInit(): void {
    // Subscribe to route param changes to handle navigation between sessions
    const paramSub = this.route.paramMap.subscribe((params) => {
      const newSessionId = params.get('sessionId') || '';
      if (!newSessionId) {
        this.router.navigate(['/backlog']);
        return;
      }

      // Only reload if session ID changed
      if (newSessionId !== this.sessionId) {
        this.sessionId = newSessionId;
        this.resetState();
        this.loadSession();
      }
    });
    this.subscriptions.push(paramSub);
  }

  private resetState(): void {
    this.session.set(null);
    this.agent.set(null);
    this.loading.set(true);
    this.error.set(null);
    this.taskContent.set('');
    this.taskLoading.set(true);
    this.agentStarted.set(false);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private loadSession(): void {
    this.loading.set(true);
    this.backlogService.getExecutionSession(this.sessionId).subscribe({
      next: (session) => {
        this.session.set(session);
        this.agent.set(this.backlogService.sessionToAgent(session));
        this.loading.set(false);
        this.loadTaskContent();
      },
      error: (err) => {
        console.error('Failed to load session:', err);
        this.error.set('Failed to load session');
        this.loading.set(false);
      },
    });
  }

  private loadTaskContent(): void {
    const session = this.session();
    if (!session) return;

    // The task file path is in the session meta
    const taskMdPath = session.meta.taskMdPath;
    if (!taskMdPath) {
      this.taskContent.set('*No task file found*');
      this.taskLoading.set(false);
      return;
    }

    this.agentService.readDocument(taskMdPath).subscribe({
      next: (response) => {
        this.taskContent.set(response.content);
        this.taskLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load task:', err);
        this.taskContent.set('*Error loading task*');
        this.taskLoading.set(false);
      },
    });
  }

  // Navigation
  goBack(): void {
    this.router.navigate(['/backlog']);
  }

  // Start execution
  startExecution(): void {
    if (!this.agentCard || this.agentStarted()) return;

    // Start the agent with a simple trigger message
    this.agentCard.startWithMessage('Begin execution');
    this.agentStarted.set(true);
  }

  // Check if we can show the start button
  canStart(): boolean {
    if (this.agentStarted()) return false;
    return true;
  }

  // Agent card events
  onAgentChange(updatedAgent: Agent): void {
    this.agent.set(updatedAgent);
  }

  onSessionStarted(agentSessionId: string): void {
    this.agentStarted.set(true);
    console.log('Agent session started:', agentSessionId);
  }

  onViewDocument(doc: AgentDocument): void {
    this.viewingDocument.set(doc);
    this.documentLoading.set(true);
    this.documentContent.set('');

    this.agentService.readDocument(doc.path).subscribe({
      next: (response) => {
        if (response.isImage) {
          this.documentContent.set(`data:${response.mimeType};base64,${response.content}`);
        } else {
          this.documentContent.set(response.content);
        }
        this.documentLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load document:', err);
        this.documentContent.set('Error loading document');
        this.documentLoading.set(false);
      },
    });
  }

  closeDocumentView(): void {
    this.viewingDocument.set(null);
    this.documentContent.set('');
  }

  get sessionName(): string {
    return this.session()?.meta.taskName || 'Execution';
  }

  getFileName(path: string): string {
    return path.split('/').pop() || path;
  }
}
