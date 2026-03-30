import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { BaseAgentComponent, BaseAgentConfig } from '../base-agent/base-agent';
import { AgentTerminalComponent } from '../agent-terminal/agent-terminal';
import { AgentInputComponent, MessagePayload } from '../agent-input/agent-input';
import { AgentsService } from '../../services/agents.service';
import { AgentsWebSocketService } from '../../services/agents-websocket.service';

/**
 * CodeReviewAgentComponent
 *
 * A custom agent component that demonstrates how to extend the base agent
 * with additional UI elements and custom behavior.
 *
 * Features:
 * - Custom fields for review type and focus areas
 * - Specialized header with review options
 * - Same terminal-centric layout as base agent
 */
@Component({
  selector: 'app-code-review-agent',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    AgentTerminalComponent,
    AgentInputComponent,
  ],
  template: `
    <div class="code-review-agent">
      <!-- Custom Header with Review Options -->
      <div class="agent-header">
        <div class="header-info">
          <div class="agent-identity">
            <mat-icon class="agent-icon">rate_review</mat-icon>
            <div class="agent-text">
              <h2>Code Review Assistant</h2>
              <p>Reviews code changes and provides structured feedback</p>
            </div>
          </div>
        </div>

        <!-- Custom Fields -->
        <div class="review-options" [class.collapsed]="optionsCollapsed()">
          <button class="options-toggle" (click)="toggleOptions()">
            <mat-icon>{{ optionsCollapsed() ? 'expand_more' : 'expand_less' }}</mat-icon>
            Review Options
          </button>

          @if (!optionsCollapsed()) {
            <div class="options-content">
              <mat-form-field appearance="outline" class="review-type-field">
                <mat-label>Review Type</mat-label>
                <mat-select [(ngModel)]="reviewType">
                  <mat-option value="full">Full Review</mat-option>
                  <mat-option value="security">Security Focus</mat-option>
                  <mat-option value="performance">Performance Focus</mat-option>
                  <mat-option value="quick">Quick Scan</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="focus-areas-field">
                <mat-label>Focus Areas (optional)</mat-label>
                <textarea
                  matInput
                  [(ngModel)]="focusAreas"
                  placeholder="e.g., error handling, API design"
                  rows="2"
                ></textarea>
              </mat-form-field>
            </div>
          }
        </div>
      </div>

      <!-- Terminal Section -->
      <div class="terminal-section">
        <app-agent-terminal
          [preSession]="preSessionState()"
          [hasSession]="hasSession()"
          [output]="sessionOutput()"
          [isProcessing]="isProcessing()"
        />

        <app-agent-input
          #agentInput
          [placeholder]="inputPlaceholder()"
          [disabled]="isProcessing()"
          [sendIcon]="hasSession() ? 'send' : 'play_arrow'"
          (messageSent)="onMessageSent($event)"
        />

        @if (hasSession()) {
          <div class="status-bar">
            @if (isProcessing()) {
              <span class="status processing">Analyzing code...</span>
            } @else {
              <span class="status waiting">Ready for review</span>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .code-review-agent {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #fafafa;
    }

    .agent-header {
      background: white;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      padding: 16px 24px;
    }

    .header-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .agent-identity {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .agent-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: #1976d2;
    }

    .agent-text {
      h2 {
        margin: 0;
        font-size: 1.125rem;
        font-weight: 600;
        color: rgba(0, 0, 0, 0.87);
      }

      p {
        margin: 0;
        font-size: 0.8125rem;
        color: rgba(0, 0, 0, 0.6);
      }
    }

    .review-options {
      border-top: 1px solid rgba(0, 0, 0, 0.06);
      margin-top: 12px;
      padding-top: 12px;
    }

    .options-toggle {
      display: flex;
      align-items: center;
      gap: 6px;
      background: none;
      border: none;
      padding: 6px 12px;
      margin-left: -12px;
      font-size: 0.8125rem;
      font-weight: 500;
      color: rgba(0, 0, 0, 0.6);
      cursor: pointer;
      border-radius: 6px;
      transition: all 0.15s;

      &:hover {
        background: rgba(0, 0, 0, 0.04);
        color: rgba(0, 0, 0, 0.87);
      }

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .options-content {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      margin-top: 12px;
    }

    .review-type-field {
      width: 200px;
    }

    .focus-areas-field {
      flex: 1;
      min-width: 250px;
    }

    ::ng-deep .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }

    .terminal-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      gap: 16px;
      min-height: 0;
    }

    .status-bar {
      width: 100%;
      max-width: 800px;
      display: flex;
      justify-content: center;
    }

    .status {
      font-size: 0.75rem;
      font-weight: 500;
      padding: 4px 12px;
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
  `],
})
export class CodeReviewAgentComponent implements OnInit {
  private agentsService = inject(AgentsService);
  private wsService = inject(AgentsWebSocketService);

  // Custom fields
  reviewType = 'full';
  focusAreas = '';
  optionsCollapsed = signal(false);

  // Session state (inherited pattern from BaseAgentComponent)
  session = signal<any>(null);
  sessionOutput = signal<string[]>([]);
  isProcessing = signal(false);

  hasSession = computed(() => this.session() !== null);

  preSessionState = computed(() => {
    if (this.hasSession()) return null;
    return {
      icon: 'rate_review',
      title: 'Code Review Assistant',
      instructions: 'Paste a diff, PR link, or describe the code you want reviewed',
    };
  });

  inputPlaceholder = computed(() => {
    return this.hasSession() ? 'Ask a follow-up question...' : 'Paste code or describe what to review...';
  });

  private repoRoot = '';

  ngOnInit(): void {
    this.setupWebSocket();
    this.loadConfig();
  }

  private loadConfig(): void {
    this.agentsService.getConfig().subscribe({
      next: (config) => {
        this.repoRoot = config.repoRoot;
      },
    });
  }

  private setupWebSocket(): void {
    this.wsService.connect();

    this.wsService.onSessionOutput.subscribe((event) => {
      if (this.session()?.sessionId === event.sessionId) {
        this.sessionOutput.update((lines) => [...lines, event.line]);
      }
    });

    this.wsService.onSessionTurnComplete.subscribe((event) => {
      if (this.session()?.sessionId === event.sessionId) {
        this.isProcessing.set(false);
      }
    });
  }

  toggleOptions(): void {
    this.optionsCollapsed.update((v) => !v);
  }

  onMessageSent(payload: MessagePayload): void {
    if (!payload.text.trim() && payload.attachments.length === 0) return;

    if (this.hasSession()) {
      this.sendFollowUp(payload.text);
    } else {
      this.startSession(payload.text);
    }
  }

  private startSession(message: string): void {
    this.isProcessing.set(true);
    this.sessionOutput.set([]);

    // Include custom fields in the request
    this.agentsService.runAgent('code-review', message, {
      cwd: this.repoRoot,
    }).subscribe({
      next: (response) => {
        this.session.set(response.session);
        this.wsService.subscribeToSession(response.session.sessionId);
      },
      error: (err) => {
        console.error('Failed to start session:', err);
        this.isProcessing.set(false);
      },
    });
  }

  private sendFollowUp(message: string): void {
    const currentSession = this.session();
    if (!currentSession) return;

    this.isProcessing.set(true);
    this.agentsService.sendMessage(currentSession.sessionId, message).subscribe({
      error: (err) => {
        console.error('Failed to send message:', err);
        this.isProcessing.set(false);
      },
    });
  }
}
