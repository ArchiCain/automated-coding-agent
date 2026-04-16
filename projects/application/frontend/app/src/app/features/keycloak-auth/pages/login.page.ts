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
          <mat-card-title class="mat-headline-4">Sign In</mat-card-title>
          <mat-card-subtitle class="mat-body-2">RTS AI Platform</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          @if (auth.error()) {
            <div class="error-message mat-body-1" role="alert">{{ auth.error() }}</div>
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
      padding: 16px; // Add padding for mobile
    }
    .login-card {
      width: 100%;
      max-width: 440px;
      padding: 32px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); // Enhanced card shadow
      border-radius: 12px; // Rounded corners for modern look
    }
    .error-message {
      color: var(--mat-sys-error);
      background-color: var(--mat-sys-error-container);
      border-left: 4px solid var(--mat-sys-error);
      padding: 12px 16px;
      margin-bottom: 24px;
      border-radius: 4px;
    }

    // Enhanced focus styles for better accessibility
    mat-form-field, mat-checkbox, button {
      &:focus-within {
        outline: 2px solid var(--mat-sys-primary);
        outline-offset: 2px;
        border-radius: 4px;
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
