import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import { AuthService } from '../services/auth.service';
import { LoginFormComponent } from '../components/login-form/login-form.component';
import { LoginCredentials } from '../types';

@Component({
  selector: 'app-login-page',
  imports: [MatCardModule, MatIconModule, LoginFormComponent],
  template: `
    <div class="login-container">
      <mat-card class="login-card">
        <mat-card-header>
          <div class="brand-header">
            <div class="brand-logo">
              <mat-icon class="logo-icon">smart_toy</mat-icon>
              <span class="brand-name">RTS AI</span>
            </div>
            <p class="brand-tagline">Intelligent Platform Solutions</p>
          </div>
          <mat-card-title>Welcome back</mat-card-title>
          <mat-card-subtitle>Sign in to your account</mat-card-subtitle>
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
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 16px;
    }
    .login-card {
      width: 100%;
      max-width: 440px;
      padding: 40px;
      border-radius: 16px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
      background: white;
    }
    .login-card mat-card-header {
      text-align: center;
      margin-bottom: 32px;
    }
    .brand-header {
      margin-bottom: 24px;
    }
    .brand-logo {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-bottom: 8px;
    }
    .logo-icon {
      font-size: 2.5rem;
      width: 2.5rem;
      height: 2.5rem;
      color: #667eea;
    }
    .brand-name {
      font-size: 2.2rem;
      font-weight: 700;
      color: #1a202c;
      letter-spacing: -0.5px;
    }
    .brand-tagline {
      font-size: 0.875rem;
      color: #718096;
      margin: 0;
      font-weight: 400;
    }
    .login-card mat-card-title {
      font-size: 1.75rem;
      font-weight: 600;
      color: #1a202c;
      margin-bottom: 8px;
    }
    .login-card mat-card-subtitle {
      font-size: 1rem;
      color: #718096;
      font-weight: 400;
    }
    .error-message {
      color: var(--app-error);
      margin-bottom: 16px;
      padding: 12px;
      border-radius: 8px;
      background-color: rgba(244, 67, 54, 0.1);
      border: 1px solid rgba(244, 67, 54, 0.2);
      text-align: center;
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
