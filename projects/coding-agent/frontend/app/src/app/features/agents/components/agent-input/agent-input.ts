import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

/**
 * Attachment types
 */
export interface Attachment {
  id: string;
  type: 'file' | 'image';
  name: string;
  size: number;
  file: File;
  preview?: string; // Base64 preview for images
}

/**
 * Message payload emitted when sending
 */
export interface MessagePayload {
  text: string;
  attachments: Attachment[];
}

/**
 * AgentInputComponent
 *
 * A dark-themed input bar with support for text input and
 * file/image attachments. Designed to sit beneath the terminal.
 */
@Component({
  selector: 'app-agent-input',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  template: `
    <div class="input-container" [class.has-attachments]="attachments().length > 0">
      <!-- Attachments preview -->
      @if (attachments().length > 0) {
        <div class="attachments-bar">
          @for (attachment of attachments(); track attachment.id) {
            <div class="attachment-chip" [class.image]="attachment.type === 'image'">
              @if (attachment.type === 'image' && attachment.preview) {
                <img [src]="attachment.preview" alt="Preview" class="image-preview" />
              } @else {
                <mat-icon>insert_drive_file</mat-icon>
              }
              <span class="attachment-name">{{ truncateName(attachment.name) }}</span>
              <button
                class="remove-btn"
                (click)="removeAttachment(attachment.id)"
                [disabled]="disabled"
              >
                <mat-icon>close</mat-icon>
              </button>
            </div>
          }
        </div>
      }

      <!-- Input row -->
      <div class="input-row">
        <!-- Attachment buttons -->
        <div class="attachment-buttons">
          <button
            class="attach-btn"
            (click)="fileInput.click()"
            [disabled]="disabled"
            matTooltip="Attach file"
          >
            <mat-icon>attach_file</mat-icon>
          </button>
          <button
            class="attach-btn"
            (click)="imageInput.click()"
            [disabled]="disabled"
            matTooltip="Attach image"
          >
            <mat-icon>image</mat-icon>
          </button>
        </div>

        <!-- Hidden file inputs -->
        <input
          type="file"
          #fileInput
          class="hidden-input"
          multiple
          (change)="onFileSelect($event, 'file')"
        />
        <input
          type="file"
          #imageInput
          class="hidden-input"
          accept="image/*"
          multiple
          (change)="onFileSelect($event, 'image')"
        />

        <!-- Text input -->
        <textarea
          #textInput
          class="message-input"
          [placeholder]="placeholder"
          [(ngModel)]="inputText"
          (keydown)="onKeydown($event)"
          [disabled]="disabled"
          rows="1"
        ></textarea>

        <!-- Send button -->
        <button
          class="send-btn"
          (click)="send()"
          [disabled]="disabled || (!inputText.trim() && attachments().length === 0)"
        >
          @if (disabled) {
            <mat-spinner diameter="18"></mat-spinner>
          } @else {
            <mat-icon>{{ sendIcon }}</mat-icon>
          }
        </button>
      </div>
    </div>
  `,
  styles: [`
    .input-container {
      background: #16162a;
      border-radius: 12px;
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.08);
      transition: border-color 0.2s;

      &:focus-within {
        border-color: rgba(255, 255, 255, 0.2);
      }
    }

    // Attachments bar
    .attachments-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 12px 12px 0 12px;
    }

    .attachment-chip {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px 4px 6px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.8);

      &.image {
        padding-left: 4px;
      }

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: rgba(255, 255, 255, 0.5);
      }

      .image-preview {
        width: 24px;
        height: 24px;
        border-radius: 4px;
        object-fit: cover;
      }

      .attachment-name {
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .remove-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        background: none;
        border: none;
        padding: 2px;
        cursor: pointer;
        color: rgba(255, 255, 255, 0.4);
        border-radius: 4px;
        transition: all 0.15s;

        &:hover {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.8);
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        mat-icon {
          font-size: 14px;
          width: 14px;
          height: 14px;
        }
      }
    }

    // Input row
    .input-row {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      padding: 12px;
    }

    .attachment-buttons {
      display: flex;
      gap: 4px;
    }

    .attach-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      background: none;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      color: rgba(255, 255, 255, 0.5);
      transition: all 0.15s;

      &:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.08);
        color: rgba(255, 255, 255, 0.8);
      }

      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
    }

    .hidden-input {
      display: none;
    }

    .message-input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      font-size: 0.9375rem;
      color: rgba(255, 255, 255, 0.9);
      resize: none;
      min-height: 36px;
      max-height: 120px;
      padding: 8px 0;
      font-family: inherit;
      line-height: 1.4;

      &::placeholder {
        color: rgba(255, 255, 255, 0.35);
      }

      &:disabled {
        opacity: 0.6;
      }
    }

    .send-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      background: #1976d2;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      color: white;
      transition: all 0.15s;
      flex-shrink: 0;

      &:hover:not(:disabled) {
        background: #1565c0;
      }

      &:disabled {
        background: rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.3);
        cursor: not-allowed;
      }

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
    }
  `],
})
export class AgentInputComponent {
  @ViewChild('textInput') textInput!: ElementRef<HTMLTextAreaElement>;

  @Input() placeholder = 'Type a message...';
  @Input() disabled = false;
  @Input() sendIcon = 'send';

  @Output() messageSent = new EventEmitter<MessagePayload>();

  inputText = '';
  attachments = signal<Attachment[]>([]);

  private idCounter = 0;

  onFileSelect(event: Event, type: 'file' | 'image'): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const attachment: Attachment = {
        id: `attachment-${this.idCounter++}`,
        type,
        name: file.name,
        size: file.size,
        file,
      };

      // Generate preview for images
      if (type === 'image') {
        const reader = new FileReader();
        reader.onload = (e) => {
          attachment.preview = e.target?.result as string;
          // Trigger update
          this.attachments.update((atts) => [...atts]);
        };
        reader.readAsDataURL(file);
      }

      this.attachments.update((atts) => [...atts, attachment]);
    }

    // Reset input
    input.value = '';
  }

  removeAttachment(id: string): void {
    this.attachments.update((atts) => atts.filter((a) => a.id !== id));
  }

  onKeydown(event: KeyboardEvent): void {
    // Enter sends, Shift+Enter for newline
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  send(): void {
    const text = this.inputText.trim();
    const atts = this.attachments();

    if (!text && atts.length === 0) return;
    if (this.disabled) return;

    this.messageSent.emit({
      text,
      attachments: [...atts],
    });

    // Clear input
    this.inputText = '';
    this.attachments.set([]);
  }

  focus(): void {
    this.textInput?.nativeElement?.focus();
  }

  truncateName(name: string, maxLength = 20): string {
    if (name.length <= maxLength) return name;
    const ext = name.split('.').pop() || '';
    const base = name.slice(0, maxLength - ext.length - 4);
    return `${base}...${ext}`;
  }
}
