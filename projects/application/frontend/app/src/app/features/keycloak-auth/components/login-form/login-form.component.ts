import { Component, ChangeDetectionStrategy, inject, output, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';

import { LoginCredentials } from '../../types';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login-form',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatCheckboxModule,
  ],
  templateUrl: './login-form.component.html',
  styleUrl: './login-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginFormComponent {
  private readonly fb = inject(FormBuilder);
  readonly auth = inject(AuthService);

  readonly submitCredentials = output<LoginCredentials>();
  readonly hidePassword = signal(true);

  readonly form = this.fb.group({
    username: ['', [
      Validators.required,
      Validators.minLength(3),
      Validators.maxLength(50),
      Validators.pattern(/^[a-zA-Z0-9._-]+$/) // Allow letters, numbers, dots, underscores, hyphens
    ]],
    password: ['', [
      Validators.required,
      Validators.minLength(6),
      Validators.maxLength(128)
    ]],
    rememberMe: [false],
  });

  togglePasswordVisibility(): void {
    this.hidePassword.set(!this.hidePassword());
  }

  onForgotPassword(): void {
    // TODO: Implement forgot password flow
    // For now, show a user-friendly message
    alert('Forgot password functionality will be available soon. Please contact your administrator for password reset assistance.');
  }

  isFieldValid(fieldName: string): boolean {
    const field = this.form.get(fieldName);
    return !!(field && field.valid && field.touched);
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.form.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  onSubmit(): void {
    if (this.form.valid) {
      const { username, password, rememberMe } = this.form.value;
      this.submitCredentials.emit({ username, password, rememberMe } as LoginCredentials);
    }
  }
}
