import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

/**
 * File chip for display
 */
export interface FileChip {
  path: string;
  name: string;
  type: 'prompt' | 'context';
}

/**
 * Agent metadata for display
 */
export interface AgentDisplayInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  files: FileChip[];
}

/**
 * AgentHeaderComponent
 *
 * Displays agent metadata above the terminal. Shows the agent's
 * name, description, category badge, and clickable file chips.
 * Can be collapsed to save space.
 */
@Component({
  selector: 'app-agent-header',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  template: `
    <div class="agent-header" [class.collapsed]="collapsed()">
      <!-- Toggle row (always visible) -->
      <button class="toggle-row" (click)="toggle()">
        <mat-icon class="toggle-icon">{{ collapsed() ? 'expand_more' : 'expand_less' }}</mat-icon>
        <span class="toggle-text">
          {{ agent.name }} - {{ agent.description }}
        </span>
      </button>

      <!-- Expanded content -->
      @if (!collapsed()) {
        <div class="header-content">
          <!-- File chips row -->
          <div class="chips-row">
            @for (file of agent.files; track file.path) {
              <button
                class="file-chip"
                [class.prompt]="file.type === 'prompt'"
                (click)="onFileClick(file)"
              >
                <mat-icon>{{ file.type === 'prompt' ? 'description' : 'insert_drive_file' }}</mat-icon>
                <span>{{ file.name }}</span>
              </button>
            }
            <span class="category-badge">{{ agent.category }}</span>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .agent-header {
      background: white;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    }

    .toggle-row {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 12px 16px;
      background: none;
      border: none;
      cursor: pointer;
      text-align: left;
      color: rgba(0, 0, 0, 0.7);
      font-size: 0.875rem;
      transition: background 0.15s;

      &:hover {
        background: rgba(0, 0, 0, 0.02);
      }

      .toggle-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: rgba(0, 0, 0, 0.4);
      }

      .toggle-text {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    .header-content {
      padding: 0 16px 16px 16px;
    }

    .chips-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .file-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      background: rgba(0, 0, 0, 0.04);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 6px;
      font-size: 0.75rem;
      color: rgba(0, 0, 0, 0.6);
      cursor: pointer;
      transition: all 0.15s;

      &:hover {
        background: rgba(0, 0, 0, 0.08);
        color: rgba(0, 0, 0, 0.87);
      }

      &.prompt {
        background: rgba(233, 30, 99, 0.08);
        border-color: rgba(233, 30, 99, 0.2);
        color: #c2185b;

        &:hover {
          background: rgba(233, 30, 99, 0.15);
        }
      }

      mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
      }
    }

    .category-badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      background: rgba(25, 118, 210, 0.1);
      border-radius: 6px;
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      color: #1976d2;
    }
  `],
})
export class AgentHeaderComponent {
  @Input({ required: true }) agent!: AgentDisplayInfo;

  @Output() fileClicked = new EventEmitter<FileChip>();
  @Output() collapsedChange = new EventEmitter<boolean>();

  collapsed = signal(false);

  toggle(): void {
    this.collapsed.update((v) => !v);
    this.collapsedChange.emit(this.collapsed());
  }

  onFileClick(file: FileChip): void {
    this.fileClicked.emit(file);
  }
}
