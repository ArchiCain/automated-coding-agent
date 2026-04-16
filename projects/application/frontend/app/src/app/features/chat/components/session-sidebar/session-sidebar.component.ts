import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { DatePipe, SlicePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';

import { ChatSession } from '../../types';

@Component({
  selector: 'app-session-sidebar',
  imports: [DatePipe, SlicePipe, MatButtonModule, MatIconModule, MatListModule],
  template: `
    <div class="session-sidebar">
      <button mat-flat-button class="new-chat-btn" (click)="createSession.emit()">
        <mat-icon>add</mat-icon> New Chat
      </button>

      <mat-nav-list>
        @for (session of sessions(); track session.id) {
          <a
            mat-list-item
            [class.active]="session.id === activeSessionId()"
            (click)="selectSession.emit(session)"
            (keyup.enter)="selectSession.emit(session)"
            tabindex="0"
          >
            <span matListItemTitle>{{ session.id | slice:0:8 }}</span>
            <span matListItemLine>{{ session.createdAt | date:'shortTime' }}</span>
            <button
              matListItemMeta
              mat-icon-button
              (click)="$event.stopPropagation(); deleteSession.emit(session)"
              aria-label="Delete session"
            >
              <mat-icon>close</mat-icon>
            </button>
          </a>
        }
      </mat-nav-list>
    </div>
  `,
  styles: [`
    .session-sidebar {
      width: 260px;
      height: 100%;
      border-right: 1px solid var(--app-divider);
      background-color: var(--app-bg-paper);
      display: flex;
      flex-direction: column;
    }
    .new-chat-btn {
      margin: 16px;
    }
    .active {
      background-color: var(--app-hover-overlay);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionSidebarComponent {
  readonly sessions = input.required<ChatSession[]>();
  readonly activeSessionId = input<string | null>(null);
  readonly selectSession = output<ChatSession>();
  readonly deleteSession = output<ChatSession>();
  readonly createSession = output<void>();
}
