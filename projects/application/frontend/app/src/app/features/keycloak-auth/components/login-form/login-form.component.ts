import { Component, ChangeDetectionStrategy, inject, output } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
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

  readonly form = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required]],
    rememberMe: [false],
  });

  onSubmit(): void {
    if (this.form.valid) {
      this.submitCredentials.emit(this.form.value as LoginCredentials);
    }
  }

  onForgotPassword(event: Event): void {
    event.preventDefault();
    // TODO: Implement forgot password functionality
    console.log('Forgot password clicked - functionality to be implemented');
  }
}
