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
        <mat-card-content>
          <h1 class="login-title">Login</h1>
          @if (auth.error()) {
            <p class="error-message">{{ auth.error() }}</p>
          }
          <app-login-form (submitCredentials)="onLogin($event)" />
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background-color: #1a1a1a;
    }

    .login-card {
      width: 100%;
      max-width: 400px;
      padding: 32px;
      background-color: #2a2a2a;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);

      &:hover {
        transform: none !important;
      }
    }

    .login-title {
      font-size: 1.75rem;
      font-weight: 500;
      text-align: center;
      color: #e7ebf0;
      margin: 0 0 32px 0;
    }

    .error-message {
      color: var(--app-error, #ff4c4f);
      margin-bottom: 16px;
    }

    /* Dark mode overrides for Material form fields within login card */
    ::ng-deep .login-card {
      .mat-mdc-card-content {
        color: #e7ebf0;
      }

      .mat-mdc-form-field {
        .mdc-text-field--outlined .mdc-notched-outline .mdc-notched-outline__leading,
        .mdc-text-field--outlined .mdc-notched-outline .mdc-notched-outline__notch,
        .mdc-text-field--outlined .mdc-notched-outline .mdc-notched-outline__trailing {
          border-color: rgba(255, 255, 255, 0.23);
        }

        .mdc-text-field--outlined:hover .mdc-notched-outline .mdc-notched-outline__leading,
        .mdc-text-field--outlined:hover .mdc-notched-outline .mdc-notched-outline__notch,
        .mdc-text-field--outlined:hover .mdc-notched-outline .mdc-notched-outline__trailing {
          border-color: rgba(255, 255, 255, 0.5);
        }

        .mdc-text-field--outlined.mdc-text-field--focused .mdc-notched-outline .mdc-notched-outline__leading,
        .mdc-text-field--outlined.mdc-text-field--focused .mdc-notched-outline .mdc-notched-outline__notch,
        .mdc-text-field--outlined.mdc-text-field--focused .mdc-notched-outline .mdc-notched-outline__trailing {
          border-color: #e0e0e0;
        }

        .mat-mdc-floating-label {
          color: #b2bac2;
        }

        .mdc-text-field--focused .mat-mdc-floating-label {
          color: #e0e0e0;
        }

        .mat-mdc-input-element {
          color: #e7ebf0;
        }

        .mat-mdc-form-field-error {
          color: var(--app-error, #ff4c4f);
        }
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
