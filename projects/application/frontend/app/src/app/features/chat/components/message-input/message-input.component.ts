import { Component, ChangeDetectionStrategy, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-message-input',
  imports: [FormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule],
  template: `
    <div class="message-input">
      <mat-form-field appearance="outline" class="input-field">
        <textarea
          matInput
          [(ngModel)]="messageText"
          placeholder="Send a message to the agent..."
          (keydown.enter)="onEnter($event)"
          [disabled]="disabled()"
          rows="1"
          cdkTextareaAutosize
          cdkAutosizeMinRows="1"
          cdkAutosizeMaxRows="6"
        ></textarea>
      </mat-form-field>
      @if (isStreaming()) {
        <button mat-flat-button color="warn" (click)="cancelMessage.emit()">
          <mat-icon>stop</mat-icon> Stop
        </button>
      } @else {
        <button mat-flat-button (click)="send()" [disabled]="!messageText().trim() || disabled()">
          <mat-icon>send</mat-icon> Send
        </button>
      }
    </div>
  `,
  styles: [`
    .message-input {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      padding: 16px;
      border-top: 1px solid var(--app-divider);
    }
    .input-field {
      flex: 1;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageInputComponent {
  readonly disabled = input(false);
  readonly isStreaming = input(false);
  readonly sendMessage = output<string>();
  readonly cancelMessage = output<void>();

  readonly messageText = signal('');

  onEnter(event: Event): void {
    if (!(event as KeyboardEvent).shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  send(): void {
    const text = this.messageText().trim();
    if (text) {
      this.sendMessage.emit(text);
      this.messageText.set('');
    }
  }
}
