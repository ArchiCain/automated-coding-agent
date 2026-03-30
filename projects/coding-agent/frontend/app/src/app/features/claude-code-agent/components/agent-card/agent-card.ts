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
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Subscription } from 'rxjs';
import {
  Agent,
  AgentDocument,
  AgentStatus,
  AgentDisplayMode,
  AgentConfig,
  AVAILABLE_MODELS,
} from '../../models/agent.model';
import { ClaudeCodeAgentService, SessionMetadata } from '../../services/claude-code-agent.service';
import { SessionWebSocketService } from '../../services/session-websocket.service';
import { SessionManagerService } from '../../services/session-manager.service';
import { TranscriptRendererComponent } from '../transcript-renderer/transcript-renderer';

@Component({
  selector: 'app-agent-card',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSelectModule,
    MatInputModule,
    MatFormFieldModule,
    TranscriptRendererComponent,
  ],
  templateUrl: './agent-card.html',
  styleUrl: './agent-card.scss',
})
export class AgentCardComponent implements OnInit, OnDestroy {
  @ViewChild('outputContainer') outputContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('messageInput') messageInput!: ElementRef<HTMLTextAreaElement>;

  @Input({ required: true }) agent!: Agent;
  @Input() initialMode: AgentDisplayMode = 'card';
  @Input() hideBackButton = false;
  @Input() startConfigCollapsed = false;
  @Input() conversational = false;
  @Output() agentChange = new EventEmitter<Agent>();
  @Output() viewDocument = new EventEmitter<AgentDocument>();
  @Output() sessionStarted = new EventEmitter<string>();
  @Output() close = new EventEmitter<void>();

  private agentService = inject(ClaudeCodeAgentService);
  private wsService = inject(SessionWebSocketService);
  private sessionManager = inject(SessionManagerService);
  private subscriptions: Subscription[] = [];

  // Display mode
  mode = signal<AgentDisplayMode>('card');

  // Configuration state (editable copy)
  editConfig = signal<AgentConfig>({
    cwd: '',
    model: 'claude-opus-4-5-20251101',
    promptFile: undefined,
    contextFiles: [],
    attachments: [],
  });

  // Session state
  session = signal<SessionMetadata | null>(null);
  sessionOutput = signal<string[]>([]);
  messageText = signal('');
  processing = signal(false);
  error = signal<string | null>(null);

  // UI state
  documentsExpanded = signal(false);
  configExpanded = signal(true);
  availableModels = AVAILABLE_MODELS;

  // Pending file attachments
  pendingAttachments = signal<Array<{ id: string; file: File; name: string; type: 'file' | 'image' }>>([]);
  private attachmentIdCounter = 0;

  ngOnInit(): void {
    // Apply initial config state
    if (this.startConfigCollapsed) {
      this.configExpanded.set(false);
    }

    if (this.initialMode === 'interactive') {
      this.openInteractive();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  // Computed values
  get isActive(): boolean {
    return this.agent.status === 'active';
  }

  get isIdle(): boolean {
    return this.agent.status === 'idle';
  }

  get isCompleted(): boolean {
    return this.agent.status === 'completed';
  }

  get isFailed(): boolean {
    return this.agent.status === 'failed';
  }

  get hasActivity(): boolean {
    return this.isActive && !!this.agent.activity;
  }

  get isInteractive(): boolean {
    return this.mode() === 'interactive';
  }

  get canEdit(): boolean {
    return this.isIdle && !this.session();
  }

  get promptDocument(): AgentDocument | undefined {
    return this.agent.documents.find((d) => d.type === 'prompt');
  }

  get contextDocuments(): AgentDocument[] {
    return this.agent.documents.filter((d) => d.type === 'context');
  }

  get visibleDocuments(): AgentDocument[] {
    const docs = this.agent.documents;
    if (this.documentsExpanded() || docs.length <= 3) {
      return docs;
    }
    return docs.slice(0, 3);
  }

  get hiddenDocumentCount(): number {
    if (this.documentsExpanded()) return 0;
    return Math.max(0, this.agent.documents.length - 3);
  }

  get statusIcon(): string {
    switch (this.agent.status) {
      case 'active':
        return 'play_circle';
      case 'completed':
        return 'check_circle';
      case 'failed':
        return 'error';
      default:
        return 'radio_button_unchecked';
    }
  }

  get activityIcon(): string {
    if (!this.agent.activity) return 'hourglass_empty';
    switch (this.agent.activity.type) {
      case 'thinking':
        return 'psychology';
      case 'reading':
        return 'visibility';
      case 'writing':
        return 'edit';
      case 'executing':
        return 'terminal';
      case 'waiting':
        return 'hourglass_empty';
      default:
        return 'hourglass_empty';
    }
  }

  get runDuration(): string {
    const sess = this.session() || this.agent.session;
    if (!sess) return '';
    const start = new Date(sess.startedAt).getTime();
    const end = sess.completedAt ? new Date(sess.completedAt).getTime() : Date.now();
    const seconds = Math.floor((end - start) / 1000);

    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  // Mode switching
  openInteractive(): void {
    // Initialize edit config from agent
    this.editConfig.set({
      cwd: this.agent.config?.cwd || this.agent.session?.cwd || '',
      model: this.agent.config?.model || this.agent.session?.model || 'claude-opus-4-5-20251101',
      promptFile: this.agent.config?.promptFile || this.promptDocument?.path,
      contextFiles: this.agent.config?.contextFiles || this.contextDocuments.map((d) => d.path),
      attachments: this.agent.config?.attachments || [],
    });

    // Load repo root for default cwd if not set
    if (!this.editConfig().cwd) {
      this.agentService.getConfig().subscribe({
        next: (config) => {
          this.editConfig.update((c) => ({ ...c, cwd: config.repoRoot }));
        },
      });
    }

    this.mode.set('interactive');
    this.setupWebSocket();
  }

  closeInteractive(): void {
    this.close.emit();
    this.mode.set('card');
    this.cleanupSession();
  }

  private setupWebSocket(): void {
    this.wsService.connect();

    this.subscriptions.push(
      this.wsService.onSessionOutput.subscribe((event) => {
        const sess = this.session();
        if (sess && event.sessionId === sess.sessionId) {
          this.sessionOutput.update((lines) => [...lines, event.line]);
          this.scrollToBottom();
        }
      }),
      this.wsService.onSessionTurnComplete.subscribe((event) => {
        const sess = this.session();
        if (sess && event.sessionId === sess.sessionId) {
          this.processing.set(false);
          this.session.set({ ...sess, status: 'paused' });
          this.focusInput();
        }
      }),
      this.wsService.onSessionPaused.subscribe((event) => {
        const sess = this.session();
        if (sess && event.sessionId === sess.sessionId) {
          this.processing.set(false);
          this.session.set({ ...sess, status: 'paused' });
          this.focusInput();
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
          // Update existing session with completion status
          this.session.set({
            ...sess,
            status: event.session.status as 'active' | 'completed' | 'failed',
            completedAt: new Date().toISOString(),
          });
          this.processing.set(false);
          this.updateAgentStatus('completed');
        }
      })
    );
  }

  private cleanupSession(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions = [];
  }

  // Agent actions

  /**
   * Start the agent with a specific message (called programmatically)
   */
  startWithMessage(message: string): void {
    if (this.processing() || this.session()) return;
    this.messageText.set(message);
    this.startAgent();
  }

  startAgent(): void {
    const config = this.editConfig();
    const message = this.messageText().trim();

    if (!message) {
      this.error.set('Please enter a message to start the agent');
      return;
    }

    this.error.set(null);
    this.processing.set(true);
    this.sessionOutput.set([]);
    this.messageText.set('');

    // Upload any pending attachments first
    const pendingAtts = this.pendingAttachments();
    if (pendingAtts.length > 0) {
      const files = pendingAtts.map((a) => a.file);
      this.agentService.uploadFiles(files).subscribe({
        next: (uploadResult) => {
          // Add uploaded files to config attachments
          const uploadedDocs: AgentDocument[] = uploadResult.attachments.map((a) => ({
            id: a.id,
            name: a.name,
            path: a.path,
            type: 'attachment' as const,
          }));
          this.editConfig.update((c) => ({
            ...c,
            attachments: [...c.attachments, ...uploadedDocs],
          }));
          this.pendingAttachments.set([]);

          // Now start the session
          this.doStartSession(message, uploadResult.attachments);
        },
        error: (err) => {
          this.error.set('Failed to upload attachments');
          this.processing.set(false);
        },
      });
    } else {
      this.doStartSession(message, []);
    }
  }

  private doStartSession(
    message: string,
    attachments: Array<{ type: string; name: string; path: string }>
  ): void {
    const config = this.editConfig();

    // Build prompt with output files and attachments (lightweight - file reading done server-side)
    const prompt = this.buildPrompt(message);

    // Start a new session, passing promptFile and contextFiles for server-side injection
    this.agentService
      .startSession(prompt, config.cwd, {
        model: config.model,
        agentName: this.agent.name,
        conversational: this.conversational,
        instructionsFile: config.promptFile,
        knowledgeFiles: config.contextFiles.length > 0 ? config.contextFiles : undefined,
      })
      .subscribe({
        next: (response) => {
          this.session.set(response.session);
          this.wsService.subscribeToSession(response.session.sessionId);
          this.updateAgentStatus('active');

          // Track in global session manager
          this.sessionManager.trackSession(response.session);

          // Emit event so parent can track the session
          this.sessionStarted.emit(response.session.sessionId);
        },
        error: (err) => {
          this.error.set(err.message || 'Failed to start session');
          this.processing.set(false);
        },
      });
  }

  /**
   * Stop/interrupt the current session
   */
  stopSession(): void {
    const sess = this.session();
    if (!sess) return;

    this.sessionManager.interruptSession(sess.sessionId);
  }

  private buildPrompt(userMessage: string): string {
    const config = this.editConfig();
    const parts: string[] = [];

    // Output files - CRITICAL: Tell agent where to save output
    const outputDocs = this.agent.documents.filter(d => d.type === 'output');
    if (outputDocs.length > 0) {
      parts.push('# Output Files\n');
      parts.push('IMPORTANT: Save your output to these EXACT file paths:');
      for (const doc of outputDocs) {
        parts.push(`- ${doc.name}: ${doc.path}`);
      }
      parts.push('');
    }

    // Attachments
    if (config.attachments.length > 0) {
      parts.push('# Attachments\n');
      parts.push('The user has provided these files. Read them for context:');
      for (const att of config.attachments) {
        parts.push(`- ${att.name}: ${att.path}`);
      }
      parts.push('');
    }

    // User message
    parts.push('# User Request\n');
    parts.push(userMessage);

    return parts.join('\n');
  }

  sendMessage(): void {
    const sess = this.session();
    const message = this.messageText().trim();
    if (!sess || !message || this.processing()) return;

    this.messageText.set('');
    this.error.set(null);
    this.processing.set(true);

    this.agentService.sendMessage(sess.sessionId, message).subscribe({
      error: (err) => {
        this.error.set(err.message || 'Failed to send message');
        this.processing.set(false);
      },
    });
  }

  private updateAgentStatus(status: AgentStatus): void {
    const updated = { ...this.agent, status };
    this.agentChange.emit(updated);
  }

  // Document handling
  toggleDocuments(): void {
    this.documentsExpanded.update((v) => !v);
  }

  onViewDocument(doc: AgentDocument, event: Event): void {
    event.stopPropagation();
    this.viewDocument.emit(doc);
  }

  removeContextFile(path: string): void {
    this.editConfig.update((c) => ({
      ...c,
      contextFiles: c.contextFiles.filter((f) => f !== path),
    }));
  }

  removeAttachment(id: string): void {
    this.editConfig.update((c) => ({
      ...c,
      attachments: c.attachments.filter((a) => a.id !== id),
    }));
  }

  removePendingAttachment(id: string): void {
    this.pendingAttachments.update((atts) => atts.filter((a) => a.id !== id));
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isImage = file.type.startsWith('image/');

      this.pendingAttachments.update((atts) => [
        ...atts,
        {
          id: `pending-${this.attachmentIdCounter++}`,
          file,
          name: file.name,
          type: isImage ? 'image' : 'file',
        },
      ]);
    }

    input.value = '';
  }

  // Input handling
  onInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (this.session()) {
        this.sendMessage();
      } else {
        this.startAgent();
      }
    }
  }

  // Config update helpers
  updateModel(model: string): void {
    this.editConfig.update((c) => ({ ...c, model }));
  }

  updateCwd(cwd: string): void {
    this.editConfig.update((c) => ({ ...c, cwd }));
  }

  // UI helpers
  toggleConfig(): void {
    this.configExpanded.update((v) => !v);
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.outputContainer) {
        const el = this.outputContainer.nativeElement;
        el.scrollTop = el.scrollHeight;
      }
    }, 0);
  }

  private focusInput(): void {
    setTimeout(() => {
      if (this.messageInput) {
        this.messageInput.nativeElement.focus();
      }
    }, 0);
  }

  getDocumentIcon(doc: AgentDocument): string {
    if (doc.type === 'prompt') return 'description';
    if (doc.type === 'output') return 'output';
    if (doc.type === 'attachment') return 'attach_file';
    return 'insert_drive_file';
  }

  viewFile(path: string, type: 'prompt' | 'context' | 'attachment'): void {
    const doc: AgentDocument = {
      id: `file-${Date.now()}`,
      name: this.getFileName(path),
      path: path,
      type: type,
    };
    this.viewDocument.emit(doc);
  }

  getFileName(path: string): string {
    return path.split('/').pop() || path;
  }
}
