import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription, interval } from 'rxjs';
import { MarkdownComponent } from 'ngx-markdown';
import {
  BrainstormService,
  BrainstormingSession,
} from '../../services/brainstorm.service';
import { DecompositionService } from '../../../decomposition/services/decomposition.service';
import { Agent, AgentDocument } from '../../../claude-code-agent/models/agent.model';
import { AgentCardComponent } from '../../../claude-code-agent/components/agent-card/agent-card';
import { ClaudeCodeAgentService } from '../../../claude-code-agent/services/claude-code-agent.service';
import { SlideOverComponent } from '../../../ui-components';

@Component({
  selector: 'app-brainstorm-session',
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
  templateUrl: './brainstorm-session.html',
  styleUrl: './brainstorm-session.scss',
})
export class BrainstormSessionComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private brainstormService = inject(BrainstormService);
  private decompositionService = inject(DecompositionService);
  private agentService = inject(ClaudeCodeAgentService);

  private subscriptions: Subscription[] = [];
  private planId: string = '';

  // Session data
  session = signal<BrainstormingSession | null>(null);
  agent = signal<Agent | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  // Name editing
  editingName = signal(false);
  editedName = signal('');

  // Plan content
  planContent = signal<string>('');
  planLoading = signal(true);

  // File slide-over state
  viewingDocument = signal<AgentDocument | null>(null);
  documentContent = signal<string>('');
  documentLoading = signal(false);

  // Decomposition state
  decomposing = signal(false);

  ngOnInit(): void {
    this.planId = this.route.snapshot.paramMap.get('planId') || '';
    if (!this.planId) {
      this.router.navigate(['/brainstorm']);
      return;
    }

    this.loadSession();
    this.startPlanPolling();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private loadSession(): void {
    this.loading.set(true);
    this.brainstormService.getSession(this.planId).subscribe({
      next: (session) => {
        this.session.set(session);
        this.agent.set(this.brainstormService.sessionToAgent(session));
        this.loading.set(false);
        this.loadPlanContent();
      },
      error: (err: Error) => {
        console.error('Failed to load session:', err);
        this.error.set('Failed to load session');
        this.loading.set(false);
      },
    });
  }

  private loadPlanContent(): void {
    const session = this.session();
    if (!session) return;

    // Get the plan.md path from the session's documents
    const planDoc = session.agent.documents.find((d) => d.name === 'plan.md');
    if (!planDoc) {
      this.planContent.set('*No plan.md found*');
      this.planLoading.set(false);
      return;
    }

    this.agentService.readDocument(planDoc.path).subscribe({
      next: (response) => {
        this.planContent.set(response.content);
        this.planLoading.set(false);
      },
      error: (err: Error) => {
        console.error('Failed to load plan:', err);
        this.planContent.set('*Error loading plan*');
        this.planLoading.set(false);
      },
    });
  }

  private startPlanPolling(): void {
    // Poll for plan updates every 3 seconds
    const pollSub = interval(3000).subscribe(() => {
      this.loadPlanContent();
      this.refreshSessionMeta(); // Also refresh session metadata (name, etc.)
    });
    this.subscriptions.push(pollSub);
  }

  private refreshSessionMeta(): void {
    this.brainstormService.getSession(this.planId).subscribe({
      next: (session) => {
        if (session) {
          const currentSession = this.session();
          // Only update if name changed to avoid unnecessary re-renders
          if (currentSession && currentSession.meta.planName !== session.meta.planName) {
            this.session.set(session);
            this.agent.set(this.brainstormService.sessionToAgent(session));
          }
        }
      },
      error: () => {
        // Silently ignore errors during polling
      },
    });
  }

  // Navigation
  goBack(): void {
    this.router.navigate(['/brainstorm']);
  }

  // Decomposition
  decomposePlan(): void {
    if (this.decomposing()) return;

    this.decomposing.set(true);

    this.decompositionService.createSession(this.planId, 'plan-to-projects').subscribe({
      next: (session) => {
        this.decomposing.set(false);
        this.router.navigate(['/decomposition', session.meta.sessionId]);
      },
      error: (err) => {
        console.error('Failed to create decomposition session:', err);
        this.decomposing.set(false);
      },
    });
  }

  // Name editing
  startEditingName(): void {
    const session = this.session();
    if (session) {
      this.editedName.set(session.meta.planName);
      this.editingName.set(true);
    }
  }

  saveName(): void {
    const newName = this.editedName().trim();
    if (!newName) {
      this.cancelEditingName();
      return;
    }

    this.brainstormService.updateSessionName(this.planId, newName).subscribe({
      next: (updatedSession) => {
        this.session.set(updatedSession);
        this.editingName.set(false);
      },
      error: (err: Error) => {
        console.error('Failed to update name:', err);
      },
    });
  }

  cancelEditingName(): void {
    this.editingName.set(false);
  }

  onNameKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.saveName();
    } else if (event.key === 'Escape') {
      this.cancelEditingName();
    }
  }

  // Agent card events
  onAgentChange(updatedAgent: Agent): void {
    this.agent.set(updatedAgent);
  }

  onSessionStarted(sessionId: string): void {
    console.log('Agent session started:', sessionId);
    // Sessions are ephemeral now, no need to link
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
      error: (err: Error) => {
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
    return this.session()?.meta.planName || 'Untitled Session';
  }

  getFileName(path: string): string {
    return path.split('/').pop() || path;
  }
}
