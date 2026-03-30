import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { Subscription } from 'rxjs';
import {
  AgentsService,
  SessionMetadata,
} from '../../../agents/services/agents.service';
import { AgentsWebSocketService } from '../../../agents/services/agents-websocket.service';
import { SlideOverComponent } from '../../../../shared';

@Component({
  selector: 'app-playground',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatMenuModule,
    SlideOverComponent,
  ],
  templateUrl: './playground.html',
  styleUrl: './playground.scss',
})
export class PlaygroundComponent implements OnInit, OnDestroy {
  @ViewChild('outputContainer') outputContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('chatInputEl') chatInputEl!: ElementRef<HTMLTextAreaElement>;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private agentsService = inject(AgentsService);
  private wsService = inject(AgentsWebSocketService);

  // Form state
  workingDirectory = signal('');

  // Chat input for all messages (initial and follow-up)
  chatInput = signal('');

  // Output state
  output = signal<string[]>([]);
  running = signal(false);
  processingTurn = signal(false);
  activeSessionId = signal<string | null>(null);
  autoScroll = signal(true);
  error = signal<string | null>(null);

  // Session state
  loadedSession = signal<SessionMetadata | null>(null);
  loadingSession = signal(false);
  initialPrompt = signal(''); // Store initial prompt for "copy prompt" feature

  // Slide-over state
  promptSlideOverOpen = signal(false);

  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    this.loadConfig();
    this.setupWebSocket();
    this.checkForSessionParam();
  }

  private loadConfig(): void {
    this.agentsService.getConfig().subscribe({
      next: (config) => {
        if (!this.workingDirectory()) {
          this.workingDirectory.set(config.repoRoot);
        }
      },
      error: () => {
        // Silently fail - user can manually enter directory
      },
    });
  }

  private checkForSessionParam(): void {
    const sessionId = this.route.snapshot.queryParamMap.get('session');
    if (sessionId) {
      this.loadSession(sessionId);
    }

    this.subscriptions.push(
      this.route.queryParamMap.subscribe((params) => {
        const newSessionId = params.get('session');
        if (newSessionId && newSessionId !== this.activeSessionId()) {
          this.loadSession(newSessionId);
        } else if (!newSessionId && this.activeSessionId()) {
          // Clear session when navigating to /playground without session param
          this.clearState();
        }
      })
    );
  }

  private loadSession(sessionId: string): void {
    this.loadingSession.set(true);
    this.error.set(null);

    this.agentsService.getSessionFull(sessionId).subscribe({
      next: (data) => {
        this.loadedSession.set(data.session);
        this.initialPrompt.set(data.prompt);
        this.workingDirectory.set(data.session.cwd);
        this.output.set(data.transcript);
        this.activeSessionId.set(sessionId);
        this.loadingSession.set(false);

        // Subscribe to session events
        this.wsService.subscribeToSession(sessionId);

        // Auto-resume paused sessions
        if (data.session.status === 'paused') {
          this.resumeSession();
        } else if (data.session.status === 'active') {
          this.running.set(true);
          this.processingTurn.set(false);
          this.focusChatInput();
        } else {
          // Completed or failed - still show but can't interact
          this.running.set(false);
          this.processingTurn.set(false);
        }

        this.scrollToBottom();
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Failed to load session');
        this.loadingSession.set(false);
      },
    });
  }

  private clearState(): void {
    this.output.set([]);
    this.error.set(null);
    this.activeSessionId.set(null);
    this.loadedSession.set(null);
    this.running.set(false);
    this.processingTurn.set(false);
    this.chatInput.set('');
    this.initialPrompt.set('');
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private setupWebSocket(): void {
    this.wsService.connect();

    this.subscriptions.push(
      this.wsService.onSessionOutput.subscribe((event) => {
        if (event.sessionId === this.activeSessionId()) {
          this.output.update((lines) => [...lines, event.line]);
          if (this.autoScroll()) {
            this.scrollToBottom();
          }
        }
      }),
      this.wsService.onSessionTurnComplete.subscribe((event) => {
        if (event.sessionId === this.activeSessionId()) {
          this.processingTurn.set(false);
          this.focusChatInput();
        }
      }),
      this.wsService.onSessionCompleted.subscribe((event) => {
        if (event.session.sessionId === this.activeSessionId()) {
          this.running.set(false);
          this.processingTurn.set(false);
          this.loadedSession.set(event.session);
        }
      }),
      this.wsService.onSessionPaused.subscribe((event) => {
        if (event.sessionId === this.activeSessionId()) {
          this.running.set(false);
          this.processingTurn.set(false);
          const current = this.loadedSession();
          if (current) {
            this.loadedSession.set({ ...current, status: 'paused' });
          }
        }
      }),
      this.wsService.onSessionError.subscribe((event) => {
        if (event.sessionId === this.activeSessionId()) {
          this.error.set(event.error);
          this.processingTurn.set(false);
        }
      })
    );
  }

  startSession(): void {
    const promptText = this.chatInput().trim();
    const cwd = this.workingDirectory().trim();

    if (!promptText) {
      this.error.set('Please enter a prompt');
      return;
    }

    if (!cwd) {
      this.error.set('Please enter a working directory');
      return;
    }

    this.error.set(null);
    this.output.set([]);
    this.running.set(true);
    this.processingTurn.set(true);
    this.initialPrompt.set(promptText);
    this.chatInput.set('');

    this.agentsService.startSession(promptText, cwd).subscribe({
      next: (response) => {
        this.activeSessionId.set(response.session.sessionId);
        this.loadedSession.set(response.session);
        this.wsService.subscribeToSession(response.session.sessionId);
        // Update URL with session ID
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { session: response.session.sessionId },
          queryParamsHandling: 'merge',
        });
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to start session');
        this.running.set(false);
        this.processingTurn.set(false);
      },
    });
  }

  resumeSession(): void {
    const sessionId = this.activeSessionId();
    if (!sessionId) return;

    this.error.set(null);
    this.running.set(true);
    this.processingTurn.set(false);

    this.agentsService.resumeSession(sessionId).subscribe({
      next: (response) => {
        this.loadedSession.set(response.session);
        this.focusChatInput();
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to resume session');
        this.running.set(false);
      },
    });
  }

  sendMessage(): void {
    const message = this.chatInput().trim();
    if (!message || !this.activeSessionId() || this.processingTurn()) return;

    this.chatInput.set('');
    this.error.set(null);
    this.processingTurn.set(true);
    this.running.set(true);

    // Update session status to active (backend auto-resumes paused sessions)
    const current = this.loadedSession();
    if (current && current.status !== 'active') {
      this.loadedSession.set({ ...current, status: 'active' });
    }

    this.agentsService.sendMessage(this.activeSessionId()!, message).subscribe({
      error: (err) => {
        this.error.set(err.message || 'Failed to send message');
        this.processingTurn.set(false);
      },
    });
  }

  stopSession(): void {
    const sessionId = this.activeSessionId();
    if (!sessionId) return;

    // Pause the session - it can be resumed later by sending another message
    this.agentsService.pauseSession(sessionId).subscribe({
      next: () => {
        this.running.set(false);
        this.processingTurn.set(false);
        // Update local session status
        const current = this.loadedSession();
        if (current) {
          this.loadedSession.set({ ...current, status: 'paused' });
        }
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to stop session');
      },
    });
  }

  clearAndStartNew(): void {
    this.clearState();
    // Navigate to /playground without session param
    this.router.navigate(['/playground']);
    this.focusChatInput();
  }

  startNewWithSamePrompt(): void {
    const prompt = this.initialPrompt();
    this.clearState();
    this.chatInput.set(prompt);
    this.router.navigate(['/playground']);
    this.focusChatInput();
  }

  viewPromptFile(): void {
    this.promptSlideOverOpen.set(true);
  }

  closePromptSlideOver(): void {
    this.promptSlideOverOpen.set(false);
  }

  toggleAutoScroll(): void {
    this.autoScroll.update((v) => !v);
    if (this.autoScroll()) {
      this.scrollToBottom();
    }
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.outputContainer) {
        const el = this.outputContainer.nativeElement;
        el.scrollTop = el.scrollHeight;
      }
    }, 0);
  }

  private focusChatInput(): void {
    setTimeout(() => {
      if (this.chatInputEl) {
        this.chatInputEl.nativeElement.focus();
      }
    }, 0);
  }

  onInputKeydown(event: KeyboardEvent): void {
    if (this.activeSessionId()) {
      // In session: Enter sends, Shift+Enter for newline
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.sendMessage();
      }
    } else {
      // No session: Cmd/Ctrl+Enter starts
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        this.startSession();
      }
    }
  }

  onSendClick(): void {
    if (this.activeSessionId()) {
      this.sendMessage();
    } else {
      this.startSession();
    }
  }
}
