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
      <mat-card class="login-card" role="main" aria-labelledby="login-title">
        <mat-card-header>
          <mat-card-title id="login-title" role="heading" aria-level="1">Sign In</mat-card-title>
          <mat-card-subtitle role="text" aria-label="Application name">RTS AI Platform</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          @if (auth.error()) {
            <div class="error-message" role="alert" aria-live="polite">{{ auth.error() }}</div>
          }
          <app-login-form (submitCredentials)="onLogin($event)" />
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
      background: linear-gradient(135deg, var(--mat-sys-primary-container) 0%, var(--mat-sys-surface-container) 100%);
      padding: 16px;
    }

    .login-card {
      width: 100%;
      max-width: 440px;
      padding: 40px 32px;
      border-radius: 16px;
      box-shadow: var(--mat-sys-elevation-3);
      background-color: var(--mat-sys-surface);
    }

    .login-card mat-card-header {
      text-align: center;
      margin-bottom: 32px;
      padding: 0;
    }

    .login-card mat-card-title {
      font-size: 1.75rem;
      font-weight: 500;
      color: var(--mat-sys-on-surface);
      margin-bottom: 8px;
    }

    .login-card mat-card-subtitle {
      font-size: 1rem;
      font-weight: 400;
      color: var(--mat-sys-on-surface-variant);
      opacity: 0.87;
    }

    .login-card mat-card-content {
      padding: 0;
    }

    .error-message {
      background-color: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 24px;
      font-size: 0.875rem;
      border-left: 4px solid var(--mat-sys-error);
    }

    @media (max-width: 480px) {
      .login-container {
        padding: 8px;
      }

      .login-card {
        padding: 24px 16px;
        border-radius: 12px;
        box-shadow: var(--mat-sys-elevation-2);
      }

      .login-card mat-card-title {
        font-size: 1.5rem;
      }

      .login-card mat-card-subtitle {
        font-size: 0.875rem;
      }
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
