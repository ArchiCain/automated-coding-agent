import { NgModule } from '@angular/core';
import { ChatPage } from './pages/chat.page';
import { MessageListComponent } from './components/message-list/message-list.component';
import { MessageInputComponent } from './components/message-input/message-input.component';
import { SessionSidebarComponent } from './components/session-sidebar/session-sidebar.component';

@NgModule({
  imports: [ChatPage, MessageListComponent, MessageInputComponent, SessionSidebarComponent],
  exports: [ChatPage, MessageListComponent, MessageInputComponent, SessionSidebarComponent],
})
export class ChatModule {}
