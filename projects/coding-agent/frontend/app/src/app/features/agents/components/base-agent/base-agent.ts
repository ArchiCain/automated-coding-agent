import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Subscription } from 'rxjs';

import { AgentTerminalComponent, PreSessionState } from '../agent-terminal/agent-terminal';
import { AgentInputComponent, MessagePayload, Attachment } from '../agent-input/agent-input';
import { AgentHeaderComponent, AgentDisplayInfo, FileChip } from '../agent-header/agent-header';
import { AgentsService, SessionMetadata, AgentDefinition } from '../../services/agents.service';
import { AgentsWebSocketService } from '../../services/agents-websocket.service';

/**
 * Base agent configuration
 */
export interface BaseAgentConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  instructions: string;
  promptFile?: string;
  contextFiles: string[];
}

/**
 * BaseAgentComponent
 *
 * The main agent UI component that composes terminal, input, and header.
 * This component handles:
 * - Session management (start, send messages, stop)
 * - WebSocket event handling
 * - Output streaming
 *
 * Can be extended by custom agent components for specialized behavior.
 */
@Component({
  selector: 'app-base-agent',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    AgentTerminalComponent,
    AgentInputComponent,
    AgentHeaderComponent,
  ],
  template: `
    <div class="agent-wrapper">
      <!-- Header section (optional, via slot or config) -->
      @if (showHeader && agentDisplayInfo()) {
        <app-agent-header
          [agent]="agentDisplayInfo()!"
          (fileClicked)="onFileClicked($event)"
          (collapsedChange)="onHeaderCollapsed($event)"
        />
      }

      <!-- Custom header slot for extended agents -->
      <ng-content select="[agent-header]"></ng-content>

      <!-- Terminal section -->
      <div class="terminal-section">
        <app-agent-terminal
          [preSession]="preSessionState()"
          [hasSession]="hasSession()"
          [output]="sessionOutput()"
          [isProcessing]="isProcessing()"
          [autoScroll]="autoScroll"
        />

        <!-- Input attached to terminal -->
        <app-agent-input
          #agentInput
          [placeholder]="inputPlaceholder()"
          [disabled]="isProcessing()"
          [sendIcon]="hasSession() ? 'send' : 'play_arrow'"
          (messageSent)="onMessageSent($event)"
        />

        <!-- Status bar -->
        @if (hasSession()) {
          <div class="status-bar">
            <div class="status-left">
              @if (isProcessing()) {
                <span class="status-label processing">Processing...</span>
              } @else {
                <span class="status-label waiting">Waiting for input</span>
              }
            </div>
            <div class="status-right">
              @if (session()?.status === 'active') {
                <button
                  class="stop-btn"
                  (click)="stopSession()"
                  [disabled]="!isProcessing()"
                >
                  <mat-icon>stop</mat-icon>
                  Stop
                </button>
              }
            </div>
          </div>
        }
      </div>

      <!-- Custom content slot for extended agents -->
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    .agent-wrapper {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #fafafa;
    }

    .terminal-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 24px;
      gap: 16px;
      min-height: 0;
    }

    .status-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      max-width: 800px;
      width: 100%;
      margin: 0 auto;
      padding: 0 4px;
    }

    .status-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .status-label {
      font-size: 0.75rem;
      font-weight: 500;
      padding: 4px 10px;
      border-radius: 12px;

      &.processing {
        background: rgba(25, 118, 210, 0.1);
        color: #1976d2;
      }

      &.waiting {
        background: rgba(76, 175, 80, 0.1);
        color: #388e3c;
      }
    }

    .status-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .stop-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 12px;
      background: rgba(244, 67, 54, 0.1);
      border: 1px solid rgba(244, 67, 54, 0.2);
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 500;
      color: #d32f2f;
      cursor: pointer;
      transition: all 0.15s;

      &:hover:not(:disabled) {
        background: rgba(244, 67, 54, 0.2);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    }
  `],
})
export class BaseAgentComponent implements OnInit, OnDestroy {
  @ViewChild('agentInput') agentInput!: AgentInputComponent;

  // Configuration
  @Input() config!: BaseAgentConfig;
  @Input() showHeader = true;
  @Input() autoScroll = true;
  @Input() workingDirectory?: string;

  // Events
  @Output() sessionStarted = new EventEmitter<SessionMetadata>();
  @Output() sessionEnded = new EventEmitter<SessionMetadata>();
  @Output() fileRequested = new EventEmitter<FileChip>();
  @Output() errorOccurred = new EventEmitter<string>();

  // Services
  protected agentsService = inject(AgentsService);
  protected wsService = inject(AgentsWebSocketService);

  // State
  session = signal<SessionMetadata | null>(null);
  sessionOutput = signal<string[]>([]);
  isProcessing = signal(false);
  error = signal<string | null>(null);

  // Computed state
  hasSession = computed(() => this.session() !== null);

  preSessionState = computed<PreSessionState | null>(() => {
    if (this.hasSession()) return null;
    return {
      icon: this.config?.icon || 'smart_toy',
      title: this.config?.name || 'Agent',
      instructions: this.config?.instructions || 'Type a message to start...',
    };
  });

  agentDisplayInfo = computed<AgentDisplayInfo | null>(() => {
    if (!this.config) return null;
    const files: FileChip[] = [];
    if (this.config.promptFile) {
      files.push({
        path: this.config.promptFile,
        name: this.getFileName(this.config.promptFile),
        type: 'prompt',
      });
    }
    for (const file of this.config.contextFiles) {
      files.push({
        path: file,
        name: this.getFileName(file),
        type: 'context',
      });
    }
    return {
      id: this.config.id,
      name: this.config.name,
      description: this.config.description,
      icon: this.config.icon,
      category: this.config.category,
      files,
    };
  });

  inputPlaceholder = computed(() => {
    if (this.hasSession()) return 'Type a message...';
    return 'Type to start a session...';
  });

  private subscriptions: Subscription[] = [];
  private repoRoot = '';

  ngOnInit(): void {
    this.setupWebSocket();
    this.loadConfig();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private loadConfig(): void {
    this.agentsService.getConfig().subscribe({
      next: (config) => {
        this.repoRoot = config.repoRoot;
        if (!this.workingDirectory) {
          this.workingDirectory = config.repoRoot;
        }
      },
    });
  }

  private setupWebSocket(): void {
    this.wsService.connect();

    this.subscriptions.push(
      this.wsService.onSessionOutput.subscribe((event) => {
        const currentSession = this.session();
        if (currentSession && event.sessionId === currentSession.sessionId) {
          this.sessionOutput.update((lines) => [...lines, event.line]);
        }
      }),

      this.wsService.onSessionTurnComplete.subscribe((event) => {
        const currentSession = this.session();
        if (currentSession && event.sessionId === currentSession.sessionId) {
          this.isProcessing.set(false);
          this.focusInput();
        }
      }),

      this.wsService.onSessionCompleted.subscribe((event) => {
        const currentSession = this.session();
        if (currentSession && event.session.sessionId === currentSession.sessionId) {
          this.session.set(event.session);
          this.isProcessing.set(false);
          this.sessionEnded.emit(event.session);
        }
      }),

      this.wsService.onSessionError.subscribe((event) => {
        const currentSession = this.session();
        if (currentSession && event.sessionId === currentSession.sessionId) {
          this.error.set(event.error);
          this.isProcessing.set(false);
          this.errorOccurred.emit(event.error);
        }
      }),

      this.wsService.onSessionPaused.subscribe((event) => {
        const currentSession = this.session();
        if (currentSession && event.sessionId === currentSession.sessionId) {
          this.session.update((s) => s ? { ...s, status: 'paused' } : null);
          this.isProcessing.set(false);
        }
      })
    );
  }

  /**
   * Handle message sent from input component
   */
  onMessageSent(payload: MessagePayload): void {
    if (!payload.text.trim() && payload.attachments.length === 0) return;

    // Build message with attachments
    const message = this.buildMessageWithAttachments(payload);

    if (this.hasSession()) {
      this.sendFollowUp(message);
    } else {
      this.startSession(message);
    }
  }

  /**
   * Build message string with attachment references
   */
  protected buildMessageWithAttachments(payload: MessagePayload): string {
    let message = payload.text;

    // TODO: Handle actual file uploads to backend
    // For now, just mention the files in the message
    if (payload.attachments.length > 0) {
      const fileList = payload.attachments
        .map((a) => `- ${a.name} (${a.type})`)
        .join('\n');
      message += `\n\n[Attachments]\n${fileList}`;
    }

    return message;
  }

  /**
   * Start a new session with the agent
   */
  protected startSession(message: string): void {
    this.error.set(null);
    this.isProcessing.set(true);
    this.sessionOutput.set([]);

    this.agentsService.runAgent(this.config.id, message, {
      cwd: this.workingDirectory,
    }).subscribe({
      next: (response) => {
        this.session.set(response.session);
        this.wsService.subscribeToSession(response.session.sessionId);
        this.sessionStarted.emit(response.session);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to start session');
        this.isProcessing.set(false);
        this.errorOccurred.emit(this.error()!);
      },
    });
  }

  /**
   * Send a follow-up message to existing session
   */
  protected sendFollowUp(message: string): void {
    const currentSession = this.session();
    if (!currentSession) return;

    this.error.set(null);
    this.isProcessing.set(true);

    this.agentsService.sendMessage(currentSession.sessionId, message).subscribe({
      error: (err) => {
        this.error.set(err.message || 'Failed to send message');
        this.isProcessing.set(false);
        this.errorOccurred.emit(this.error()!);
      },
    });
  }

  /**
   * Stop the current session
   */
  stopSession(): void {
    const currentSession = this.session();
    if (!currentSession) return;

    this.agentsService.pauseSession(currentSession.sessionId).subscribe({
      next: () => {
        this.session.update((s) => s ? { ...s, status: 'paused' } : null);
        this.isProcessing.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to stop session');
        this.errorOccurred.emit(this.error()!);
      },
    });
  }

  /**
   * Resume a paused session
   */
  resumeSession(): void {
    const currentSession = this.session();
    if (!currentSession || currentSession.status !== 'paused') return;

    this.agentsService.resumeSession(currentSession.sessionId).subscribe({
      next: (response) => {
        this.session.set(response.session);
        this.focusInput();
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to resume session');
        this.errorOccurred.emit(this.error()!);
      },
    });
  }

  /**
   * Handle file chip click
   */
  onFileClicked(file: FileChip): void {
    this.fileRequested.emit(file);
  }

  /**
   * Handle header collapse
   */
  onHeaderCollapsed(collapsed: boolean): void {
    // Can be overridden by subclasses
  }

  /**
   * Focus the input
   */
  focusInput(): void {
    setTimeout(() => this.agentInput?.focus(), 0);
  }

  /**
   * Get filename from path
   */
  protected getFileName(path: string): string {
    return path.split('/').pop() || path;
  }
}
