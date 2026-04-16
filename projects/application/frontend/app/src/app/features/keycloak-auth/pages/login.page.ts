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
      background: #fafafa; /* Material Design surface color */
      padding: 24px; /* 3 * 8dp */
    }

    .login-content {
      width: 100%;
      max-width: 480px; /* 60 * 8dp */
      display: flex;
      flex-direction: column;
      gap: 32px; /* 4 * 8dp - Material Design spacing */
    }

    .brand-section {
      text-align: center;
      color: rgba(0, 0, 0, 0.87); /* Material Design primary text */
    }

    .logo {
      margin-bottom: 16px; /* 2 * 8dp */
    }

    .logo-icon {
      font-size: 48px; /* 6 * 8dp */
      width: 48px;
      height: 48px;
      color: #1976d2; /* Material Design primary color */
    }

    .brand-title {
      font-size: 2.125rem; /* Material Design h4 scale */
      font-weight: 400; /* Material Design h4 weight */
      margin: 0 0 8px 0; /* 1 * 8dp bottom margin */
      color: rgba(0, 0, 0, 0.87);
      letter-spacing: 0.00735em; /* Material Design h4 letter spacing */
      line-height: 1.235; /* Material Design h4 line height */
    }

    .brand-subtitle {
      font-size: 1rem; /* Material Design body1 scale */
      color: rgba(0, 0, 0, 0.6); /* Material Design secondary text */
      margin: 0;
      font-weight: 400; /* Material Design body1 weight */
      line-height: 1.5; /* Material Design body1 line height */
      letter-spacing: 0.00938em; /* Material Design body1 letter spacing */
    }

    .section-divider {
      margin: 0 32px; /* 4 * 8dp horizontal margin */
    }

    .login-card {
      background: #ffffff;
      border-radius: 12px; /* Material Design card border radius */
      /* Material Design elevation 8 */
      box-shadow:
        0px 5px 5px -3px rgba(0, 0, 0, 0.2),
        0px 8px 10px 1px rgba(0, 0, 0, 0.14),
        0px 3px 14px 2px rgba(0, 0, 0, 0.12);
    }

    .error-banner {
      display: flex;
      align-items: center;
      gap: 8px; /* 1 * 8dp */
      background-color: #ffebee; /* Material Design error surface */
      border: 1px solid #ffcdd2;
      border-radius: 8px; /* 1 * 8dp */
      padding: 16px; /* 2 * 8dp */
      margin-bottom: 24px; /* 3 * 8dp */
      color: #c62828; /* Material Design error color */
    }

    .error-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .error-text {
      font-size: 0.875rem; /* Material Design body2 scale */
      font-weight: 400;
      line-height: 1.43; /* Material Design body2 line height */
      letter-spacing: 0.01071em; /* Material Design body2 letter spacing */
    }

    .footer-section {
      text-align: center;
      padding-top: 8px; /* 1 * 8dp */
    }

    .help-text {
      font-size: 0.875rem; /* Material Design body2 scale */
      color: rgba(0, 0, 0, 0.6); /* Material Design secondary text */
      margin: 0;
      line-height: 1.43;
      letter-spacing: 0.01071em;
    }

    @media (max-width: 768px) {
      .login-container {
        padding: 16px; /* 2 * 8dp for mobile */
      }

      .login-content {
        gap: 24px; /* 3 * 8dp for mobile */
        max-width: 100%;
      }

      .brand-title {
        font-size: 1.75rem; /* Material Design h5 scale for mobile */
        line-height: 1.334; /* Material Design h5 line height */
      }

      .section-divider {
        margin: 0 16px; /* 2 * 8dp for mobile */
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
