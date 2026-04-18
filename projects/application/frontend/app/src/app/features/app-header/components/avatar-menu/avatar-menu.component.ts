import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';

import { AuthService } from '@features/keycloak-auth';

@Component({
  selector: 'app-avatar-menu',
  imports: [MatButtonModule, MatIconModule, MatMenuModule],
  template: `
    <button mat-icon-button [matMenuTriggerFor]="menu" aria-label="User menu">
      <mat-icon>account_circle</mat-icon>
    </button>
    <mat-menu #menu="matMenu">
      @if (auth.user()) {
        <div class="user-info">
          <span class="username">{{ auth.user()?.username }}</span>
        </div>
      }
      <button mat-menu-item (click)="auth.logout()">
        <mat-icon>logout</mat-icon>
        <span>Sign Out</span>
      </button>
    </mat-menu>
  `,
  styles: [`
    .user-info {
      padding: 8px 16px;
      border-bottom: 1px solid var(--app-divider);
      margin-bottom: 4px;
    }
    .username {
      font-weight: 600;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
/** User avatar icon button with dropdown menu showing username and sign-out action. */
export class AvatarMenuComponent {
  readonly auth = inject(AuthService);
}
