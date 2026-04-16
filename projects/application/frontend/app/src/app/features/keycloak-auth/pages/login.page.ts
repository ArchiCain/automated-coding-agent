import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';

import { AuthService } from '../services/auth.service';
import { LoginFormComponent } from '../components/login-form/login-form.component';
import { LoginCredentials } from '../types';

@Component({
  selector: 'app-login-page',
  imports: [MatCardModule, MatIconModule, MatDividerModule, LoginFormComponent],
  template: `
    <div class="login-container">
      <div class="login-content">
        <div class="brand-section">
          <div class="logo">
            <mat-icon class="logo-icon">smart_toy</mat-icon>
          </div>
          <h1 class="brand-title">RTS AI Platform</h1>
          <p class="brand-subtitle">Sign in to access your AI-powered tools and analytics</p>
        </div>

        <mat-divider class="section-divider"></mat-divider>

        <mat-card class="login-card">
          <mat-card-content>
            @if (auth.error()) {
              <div class="error-banner">
                <mat-icon class="error-icon">error</mat-icon>
                <span class="error-text">{{ auth.error() }}</span>
              </div>
            }
            <app-login-form (submitCredentials)="onLogin($event)" />
          </mat-card-content>
        </mat-card>

        <div class="footer-section">
          <p class="help-text">Need help signing in? Contact your system administrator.</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      padding: 24px;
    }

    .login-content {
      width: 100%;
      max-width: 480px;
      display: flex;
      flex-direction: column;
      gap: 32px;
    }

    .brand-section {
      text-align: center;
      color: #1a1a1a;
    }

    .logo {
      margin-bottom: 16px;
    }

    .logo-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #1976d2;
    }

    .brand-title {
      font-size: 2.5rem;
      font-weight: 300;
      margin: 0 0 8px 0;
      color: #1a1a1a;
      letter-spacing: -0.02em;
    }

    .brand-subtitle {
      font-size: 1.1rem;
      color: #666;
      margin: 0;
      font-weight: 400;
      line-height: 1.4;
    }

    .section-divider {
      margin: 0 40px;
    }

    .login-card {
      background: #ffffff;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .error-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      background-color: #ffebee;
      border: 1px solid #ffcdd2;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 24px;
      color: #c62828;
    }

    .error-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .error-text {
      font-size: 0.9rem;
      font-weight: 500;
    }

    .footer-section {
      text-align: center;
    }

    .help-text {
      font-size: 0.9rem;
      color: #666;
      margin: 0;
    }

    @media (max-width: 768px) {
      .login-container {
        padding: 16px;
      }

      .login-content {
        gap: 24px;
        max-width: 100%;
      }

      .brand-title {
        font-size: 2rem;
      }

      .section-divider {
        margin: 0 20px;
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
