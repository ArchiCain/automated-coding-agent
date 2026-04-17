import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

import { AuthService } from '../services/auth.service';
import { LoginFormComponent } from '../components/login-form/login-form.component';
import { LoginCredentials } from '../types';

@Component({
  selector: 'app-login-page',
  imports: [MatCardModule, LoginFormComponent],
  template: `
    <div class="login-container">
      <mat-card class="login-card mat-elevation-z4">
        <mat-card-content>
          <h1 class="login-title">Sign In</h1>
          @if (auth.error()) {
            <p class="error-message">{{ auth.error() }}</p>
          }
          <app-login-form [isLoading]="auth.isLoading()" (submitCredentials)="onLogin($event)" />
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background-color: #f5f5f5;
    }

    :host-context(.dark-theme) .login-container {
      background-color: var(--app-bg-default);
    }

    .login-card {
      width: 100%;
      max-width: 440px;
      padding: 32px;

      &:hover {
        transform: none;
      }
    }

    .login-title {
      text-align: center;
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 24px;
      color: var(--app-text-primary);
    }

    .error-message {
      color: var(--app-error);
      margin-bottom: 16px;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  readonly auth = inject(AuthService);

  onLogin(credentials: LoginCredentials): void {
    this.auth.login(credentials);
  }
}
