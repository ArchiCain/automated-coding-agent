import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent, NavDrawerComponent } from './features/layout';
import { CommandRunnerDrawerComponent } from './features/tasks';
import { ChatbotWidgetComponent } from './features/chatbot';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    HeaderComponent,
    NavDrawerComponent,
    CommandRunnerDrawerComponent,
    ChatbotWidgetComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  navDrawerOpen = signal(false);

  onMenuClick(): void {
    this.navDrawerOpen.set(true);
  }

  onNavDrawerClosed(): void {
    this.navDrawerOpen.set(false);
  }
}
