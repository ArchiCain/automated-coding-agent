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
      <mat-card class="login-card">
        <mat-card-header>
          <mat-card-title>Sign In</mat-card-title>
          <mat-card-subtitle>RTS AI Platform</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          @if (auth.error()) {
            <p class="error-message">{{ auth.error() }}</p>
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
      background-color: var(--app-bg-default);
      padding: 16px;
    }
    .login-card {
      width: 100%;
      max-width: 440px;
      padding: 32px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.12);
    }
    .login-card mat-card-title {
      font-size: 2rem;
      font-weight: 500;
      margin-bottom: 8px;
      color: var(--app-text-primary);
    }
    .login-card mat-card-subtitle {
      font-size: 1rem;
      font-weight: 400;
      color: var(--app-text-secondary);
      margin-bottom: 24px;
    }
    .error-message {
      color: var(--app-error);
      margin-bottom: 16px;
      padding: 12px;
      border-radius: 4px;
      background-color: rgba(244, 67, 54, 0.1);
    }

    /* Responsive design for mobile devices */
    @media (max-width: 480px) {
      .login-container {
        padding: 8px;
        align-items: flex-start;
        padding-top: 80px;
      }
      .login-card {
        padding: 24px 20px;
        max-width: 100%;
        margin: 0;
      }
      .login-card mat-card-title {
        font-size: 1.75rem;
      }
      .login-card mat-card-subtitle {
        font-size: 0.9rem;
      }
    }

    @media (max-width: 320px) {
      .login-card {
        padding: 20px 16px;
      }
      .login-card mat-card-title {
        font-size: 1.5rem;
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
