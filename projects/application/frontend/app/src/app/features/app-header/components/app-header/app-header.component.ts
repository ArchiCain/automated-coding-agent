import { Component, ChangeDetectionStrategy, output } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { ThemeToggleComponent } from '@features/theme';
import { AvatarMenuComponent } from '../avatar-menu/avatar-menu.component';

@Component({
  selector: 'app-header',
  imports: [MatToolbarModule, MatIconModule, MatButtonModule, ThemeToggleComponent, AvatarMenuComponent],
  template: `
    <mat-toolbar class="app-header">
      <button mat-icon-button (click)="menuToggle.emit()" aria-label="Toggle navigation">
        <mat-icon>menu</mat-icon>
      </button>
      <span class="app-title">RTS AI Platform</span>
      <span class="spacer"></span>
      <app-theme-toggle />
      <app-avatar-menu />
    </mat-toolbar>
  `,
  styles: [`
    .app-header {
      position: sticky;
      top: 0;
      z-index: 1100;
      background-color: var(--app-bg-paper);
      border-bottom: 1px solid var(--app-divider);
      box-shadow: none;
    }
    .app-title {
      margin-left: 8px;
      font-weight: 600;
      font-size: 1.1rem;
    }
    .spacer {
      flex: 1;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppHeaderComponent {
  readonly menuToggle = output<void>();
}
