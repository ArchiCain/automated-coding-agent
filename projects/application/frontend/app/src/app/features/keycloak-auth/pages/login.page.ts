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
      <mat-card class="login-card animated-card">
        <mat-card-header>
          <mat-card-title>Sign In</mat-card-title>
          <mat-card-subtitle>AI Platform</mat-card-subtitle>
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
    }
    .login-card {
      width: 100%;
      max-width: 440px;
      padding: 32px;
      border-radius: 12px;
    }
    .animated-card {
      animation: slideUpFadeIn 600ms ease-out forwards;
    }
    @media (prefers-reduced-motion: reduce) {
      .animated-card {
        animation: none;
      }
    }
    @keyframes slideUpFadeIn {
      0% {
        opacity: 0;
        transform: translateY(20px);
      }
      100% {
        opacity: 1;
        transform: translateY(0);
      }
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
