import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  inject,
  ViewChild,
  ElementRef,
  OnDestroy,
  OnInit,
  OnChanges,
  SimpleChanges,
  effect,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription, firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { ChatbotScopeContext } from '../../models/chatbot-scope.model';
import { ScreenshotService } from '../../services/screenshot.service';
import {
  ClaudeCodeAgentService,
  SessionMetadata,
} from '../../../claude-code-agent/services/claude-code-agent.service';
import { SessionWebSocketService } from '../../../claude-code-agent/services/session-websocket.service';
import { SessionManagerService } from '../../../claude-code-agent/services/session-manager.service';
import { TranscriptRendererComponent } from '../../../claude-code-agent/components/transcript-renderer/transcript-renderer';

@Component({
  selector: 'app-chatbot-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    TranscriptRendererComponent,
  ],
  templateUrl: './chatbot-panel.html',
  styleUrl: './chatbot-panel.scss',
})
export class ChatbotPanelComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('outputContainer') outputContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('messageInput') messageInput!: ElementRef<HTMLTextAreaElement>;

  @Input({ required: true }) scope!: ChatbotScopeContext;
  @Input() resumedSessionId: string | null = null;
  @Input() resumedTranscript: string[] | null = null;
  @Input() messageContext: string | null = null;
  @Output() minimize = new EventEmitter<void>();
  @Output() viewDocument = new EventEmitter<string>();
  @Output() sessionCreated = new EventEmitter<string>();
  @Output() newSession = new EventEmitter<void>();
  @Output() turnComplete = new EventEmitter<void>();

  private agentService = inject(ClaudeCodeAgentService);
  private wsService = inject(SessionWebSocketService);
  private sessionManager = inject(SessionManagerService);
  private screenshotService = inject(ScreenshotService);
  private router = inject(Router);
  private subscriptions: Subscription[] = [];

  session = signal<SessionMetadata | null>(null);
  transcript = signal<string[]>([]);
  messageText = signal('');
  processing = signal(false);
  error = signal<string | null>(null);

  // Screenshot state
  screenshotPreview = signal<string | null>(null);
  screenshotUrl = signal<string | null>(null);
  screenshotFile = signal<File | null>(null);
  capturingScreenshot = signal(false);

  // Auto-scroll tracking
  userScrolledUp = signal(false);
  private lastTrackedOutputLength = 0;

  transcriptLength = computed(() => this.transcript().length);

  constructor() {
    effect(() => {
      const currentLength = this.transcriptLength();
      if (currentLength > this.lastTrackedOutputLength) {
        this.lastTrackedOutputLength = currentLength;
        if (!this.userScrolledUp()) {
          requestAnimationFrame(() => this.scrollToBottom());
        }
      }
    });
  }

  ngOnInit(): void {
    this.setupWebSocket();

    if (this.resumedSessionId && this.resumedTranscript) {
      this.resumeExistingSession(this.resumedSessionId, this.resumedTranscript);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['resumedSessionId'] && !changes['resumedSessionId'].firstChange) {
      if (this.resumedSessionId && this.resumedTranscript) {
        this.resumeExistingSession(this.resumedSessionId, this.resumedTranscript);
      }
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private setupWebSocket(): void {
    this.wsService.connect();

    this.subscriptions.push(
      this.wsService.onSessionOutput.subscribe((event) => {
        const sess = this.session();
        if (sess && event.sessionId === sess.sessionId) {
          this.transcript.update((lines) => [...lines, event.line]);
        }
      }),
      this.wsService.onSessionTurnComplete.subscribe((event) => {
        const sess = this.session();
        if (sess && event.sessionId === sess.sessionId) {
          this.processing.set(false);
          this.session.set({ ...sess, status: 'paused' });
          this.focusInput();
          this.turnComplete.emit();
        }
      }),
      this.wsService.onSessionPaused.subscribe((event) => {
        const sess = this.session();
        if (sess && event.sessionId === sess.sessionId) {
          this.processing.set(false);
          this.session.set({ ...sess, status: 'paused' });
          this.focusInput();
          this.turnComplete.emit();
        }
      }),
      this.wsService.onSessionError.subscribe((event) => {
        const sess = this.session();
        if (sess && event.sessionId === sess.sessionId) {
          this.error.set(event.error);
          this.processing.set(false);
        }
      }),
      this.wsService.onSessionCompleted.subscribe((event) => {
        const sess = this.session();
        if (sess && event.session.sessionId === sess.sessionId) {
          this.session.set({
            ...sess,
            status: event.session.status as SessionMetadata['status'],
            completedAt: new Date().toISOString(),
          });
          this.processing.set(false);
          this.turnComplete.emit();
        }
      }),
    );
  }

  private resumeExistingSession(sessionId: string, transcript: string[]): void {
    this.transcript.set(transcript);
    this.processing.set(false);

    this.agentService.getSession(sessionId).subscribe({
      next: (response) => {
        if (response.session) {
          this.session.set(response.session);
          this.wsService.subscribeToSession(sessionId);
          if (response.session.status === 'active') {
            this.processing.set(true);
          }
        }
      },
    });
  }

  async startSession(message: string): Promise<void> {
    if (this.processing() || !message.trim()) return;

    this.error.set(null);
    this.processing.set(true);
    this.transcript.set([
      JSON.stringify({ type: 'user', message: { content: message.trim() } }),
    ]);
    this.messageText.set('');

    let apiMessage = message;
    if (this.messageContext) {
      apiMessage = this.messageContext + '\n\n' + message;
    }
    const enrichedMessage = await this.buildMessageWithScreenshot(apiMessage);

    this.agentService
      .startSession(enrichedMessage, this.scope.cwd || '', {
        instructionsFile: this.scope.instructionsFile,
        knowledgeFiles: this.scope.knowledgeFiles.length > 0 ? this.scope.knowledgeFiles : undefined,
        conversational: true,
        agentName: this.scope.scopeLabel,
        agentSlug: this.scope.agentSlug,
        startedFromRoute: this.router.url,
        model: this.scope.defaultModel,
        provider: this.scope.provider,
        readOnly: this.scope.readOnly,
      })
      .subscribe({
        next: (response) => {
          this.session.set(response.session);
          this.wsService.subscribeToSession(response.session.sessionId);
          this.sessionManager.trackSession(response.session);
          this.sessionCreated.emit(response.session.sessionId);
        },
        error: (err) => {
          this.error.set(err.message || 'Failed to start session');
          this.processing.set(false);
        },
      });
  }

  async sendMessage(): Promise<void> {
    const sess = this.session();
    const message = this.messageText().trim();
    if (!sess || !message || this.processing()) return;

    this.messageText.set('');
    this.error.set(null);
    this.processing.set(true);
    this.transcript.update((lines) => [
      ...lines,
      JSON.stringify({ type: 'user', message: { content: message } }),
    ]);

    const enrichedMessage = await this.buildMessageWithScreenshot(message);

    this.agentService.sendMessage(sess.sessionId, enrichedMessage).subscribe({
      error: (err) => {
        this.error.set(err.message || 'Failed to send message');
        this.processing.set(false);
      },
    });
  }

  stopSession(): void {
    const sess = this.session();
    if (!sess) return;
    this.sessionManager.interruptSession(sess.sessionId);
  }

  onInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (this.session()) {
        this.sendMessage();
      } else {
        this.startSession(this.messageText());
      }
    }
  }

  onViewPrompt(): void {
    this.viewDocument.emit(this.scope.instructionsFile);
  }

  onScroll(event: Event): void {
    const element = event.target as HTMLElement;
    const atBottom =
      element.scrollHeight - element.scrollTop <= element.clientHeight + 50;
    this.userScrolledUp.set(!atBottom);
  }

  resumeAutoScroll(): void {
    this.userScrolledUp.set(false);
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    if (this.outputContainer) {
      const el = this.outputContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }

  private focusInput(): void {
    setTimeout(() => {
      if (this.messageInput) {
        this.messageInput.nativeElement.focus();
      }
    }, 0);
  }

  async captureScreenshot(): Promise<void> {
    this.capturingScreenshot.set(true);
    try {
      const { blob, url } = await this.screenshotService.capturePageScreenshot();
      const file = new File([blob], `screenshot-${Date.now()}.png`, { type: 'image/png' });
      this.screenshotFile.set(file);
      this.screenshotUrl.set(url);

      const reader = new FileReader();
      reader.onload = () => this.screenshotPreview.set(reader.result as string);
      reader.readAsDataURL(blob);
    } catch (err) {
      this.error.set('Failed to capture screenshot');
    } finally {
      this.capturingScreenshot.set(false);
    }
  }

  dismissScreenshot(): void {
    this.screenshotPreview.set(null);
    this.screenshotUrl.set(null);
    this.screenshotFile.set(null);
  }

  private async buildMessageWithScreenshot(userMessage: string): Promise<string> {
    const file = this.screenshotFile();
    const pageUrl = this.screenshotUrl();
    if (!file || !pageUrl) return userMessage;

    try {
      const response = await firstValueFrom(this.agentService.uploadFiles([file]));
      const path = response.attachments[0]?.path;
      this.dismissScreenshot();
      if (!path) return userMessage;

      return `[Page Screenshot Context]
URL: ${pageUrl}
Screenshot saved at: ${path}

IMPORTANT: Use the Read tool to view the screenshot image above to see the page.

---

${userMessage}`;
    } catch {
      this.dismissScreenshot();
      return userMessage;
    }
  }

  onNewSession(): void {
    this.resetForNewScope();
    this.newSession.emit();
  }

  /** Reset panel for a new scope (called by parent when scope changes) */
  resetForNewScope(): void {
    this.session.set(null);
    this.transcript.set([]);
    this.messageText.set('');
    this.processing.set(false);
    this.error.set(null);
    this.userScrolledUp.set(false);
    this.lastTrackedOutputLength = 0;
    this.dismissScreenshot();
  }
}
