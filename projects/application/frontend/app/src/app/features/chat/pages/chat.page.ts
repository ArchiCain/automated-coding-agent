import { Component, ChangeDetectionStrategy, inject, OnInit, OnDestroy } from '@angular/core';

import { ChatService } from '../services/chat.service';
import { MessageListComponent } from '../components/message-list/message-list.component';
import { MessageInputComponent } from '../components/message-input/message-input.component';
import { SessionSidebarComponent } from '../components/session-sidebar/session-sidebar.component';


@Component({
  selector: 'app-chat-page',
  imports: [MessageListComponent, MessageInputComponent, SessionSidebarComponent],
  template: `
    <div class="chat-page">
      <app-session-sidebar
        [sessions]="chat.sessions()"
        [activeSessionId]="chat.activeSession()?.id ?? null"
        (selectSession)="chat.selectSession($event)"
        (deleteSession)="chat.deleteSession($event)"
        (createSession)="chat.createSession()"
      />
      <div class="chat-main">
        <app-message-list
          [messages]="chat.messages()"
          [isStreaming]="chat.isStreaming()"
        />
        <app-message-input
          [disabled]="!chat.activeSession()"
          [isStreaming]="chat.isStreaming()"
          (sendMessage)="chat.sendMessage($event)"
          (cancelMessage)="chat.cancelMessage()"
        />
      </div>
    </div>
  `,
  styles: [`
    .chat-page {
      display: flex;
      height: calc(100vh - 64px);
      margin: -24px;
    }
    .chat-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatPage implements OnInit, OnDestroy {
  readonly chat = inject(ChatService);

  ngOnInit(): void {
    this.chat.connect();
    this.chat.loadSessions();
  }

  ngOnDestroy(): void {
    this.chat.disconnect();
  }
}
