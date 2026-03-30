import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  AfterViewChecked,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

/**
 * Pre-session state configuration
 */
export interface PreSessionState {
  icon: string;
  title: string;
  instructions: string;
}

/**
 * AgentTerminalComponent
 *
 * A centered terminal "black box" that displays agent output.
 * This is the core visual element of the agent UI - the agent
 * feels like it lives inside this terminal.
 */
@Component({
  selector: 'app-agent-terminal',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div
      class="terminal-container"
      [class.has-session]="hasSession"
      [class.processing]="isProcessing"
      #terminalContainer
    >
      @if (!hasSession && preSession) {
        <!-- Pre-session state: centered agent icon + instructions -->
        <div class="pre-session">
          <div class="agent-icon-wrapper">
            <mat-icon>{{ preSession.icon }}</mat-icon>
          </div>
          <h3 class="agent-title">{{ preSession.title }}</h3>
          <p class="agent-instructions">{{ preSession.instructions }}</p>
        </div>
      } @else if (hasSession) {
        <!-- Session output -->
        <div class="output-area" #outputArea>
          @for (line of output; track $index) {
            <pre class="output-line">{{ line }}</pre>
          } @empty {
            <div class="starting-session">
              <mat-spinner diameter="24"></mat-spinner>
              <p>Starting session...</p>
            </div>
          }
        </div>
      }

      <!-- Processing indicator overlay -->
      @if (isProcessing && hasSession && output.length > 0) {
        <div class="processing-indicator">
          <mat-spinner diameter="16"></mat-spinner>
        </div>
      }
    </div>
  `,
  styles: [`
    .terminal-container {
      background: #1a1a2e;
      border-radius: 12px;
      min-height: 300px;
      max-height: 500px;
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      position: relative;
      overflow: hidden;
      box-shadow:
        0 4px 6px rgba(0, 0, 0, 0.3),
        0 1px 3px rgba(0, 0, 0, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.05);
    }

    // Pre-session state
    .pre-session {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 32px;
      text-align: center;
    }

    .agent-icon-wrapper {
      width: 72px;
      height: 72px;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;

      mat-icon {
        font-size: 36px;
        width: 36px;
        height: 36px;
        color: rgba(255, 255, 255, 0.7);
      }
    }

    .agent-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.9);
      margin: 0 0 12px 0;
      font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
    }

    .agent-instructions {
      font-size: 0.875rem;
      color: rgba(255, 255, 255, 0.5);
      margin: 0;
      max-width: 400px;
      line-height: 1.5;
    }

    // Output area
    .output-area {
      flex: 1;
      overflow-y: auto;
      padding: 16px 20px;
      font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
      font-size: 0.8125rem;
      line-height: 1.6;

      &::-webkit-scrollbar {
        width: 8px;
      }

      &::-webkit-scrollbar-track {
        background: transparent;
      }

      &::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.15);
        border-radius: 4px;

        &:hover {
          background: rgba(255, 255, 255, 0.25);
        }
      }
    }

    .output-line {
      margin: 0;
      padding: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
      color: rgba(255, 255, 255, 0.85);
    }

    .starting-session {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 12px;
      color: rgba(255, 255, 255, 0.5);

      p {
        margin: 0;
        font-size: 0.875rem;
      }
    }

    // Processing indicator
    .processing-indicator {
      position: absolute;
      bottom: 12px;
      right: 12px;
      padding: 6px;
      background: rgba(0, 0, 0, 0.5);
      border-radius: 8px;
    }
  `],
})
export class AgentTerminalComponent implements AfterViewChecked {
  @ViewChild('outputArea') outputArea!: ElementRef<HTMLDivElement>;

  @Input() preSession: PreSessionState | null = null;
  @Input() hasSession = false;
  @Input() output: string[] = [];
  @Input() isProcessing = false;
  @Input() autoScroll = true;

  private shouldScroll = false;

  ngAfterViewChecked(): void {
    if (this.shouldScroll && this.autoScroll && this.outputArea) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  ngOnChanges(): void {
    this.shouldScroll = true;
  }

  scrollToBottom(): void {
    if (this.outputArea) {
      const el = this.outputArea.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }
}
