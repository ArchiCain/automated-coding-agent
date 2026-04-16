import { Component, ChangeDetectionStrategy, inject, input, output, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';

import { User, CreateUserRequest, UpdateUserRequest } from '../../types';

@Component({
  selector: 'app-user-form',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule],
  templateUrl: './user-form.component.html',
  styleUrl: './user-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  readonly user = input<User | null>(null);
  readonly submitForm = output<CreateUserRequest | UpdateUserRequest>();
  readonly cancelForm = output<void>();

  readonly availableRoles = ['admin', 'user', 'viewer'];

  readonly form = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: [''],
    firstName: [''],
    lastName: [''],
    roles: [['user'] as string[], Validators.required],
  });

  get isEditMode(): boolean {
    return this.user() !== null;
  }

  ngOnInit(): void {
    const existingUser = this.user();
    if (existingUser) {
      this.form.patchValue({
        username: existingUser.username,
        email: existingUser.email,
        firstName: existingUser.firstName ?? '',
        lastName: existingUser.lastName ?? '',
        roles: existingUser.roles,
      });
      this.form.get('username')?.disable();
      this.form.get('password')?.clearValidators();
    } else {
      this.form.get('password')?.setValidators([Validators.required, Validators.minLength(8)]);
    }
    this.form.get('password')?.updateValueAndValidity();
  }

  onSubmit(): void {
    if (this.form.valid) {
      this.submitForm.emit(this.form.getRawValue() as CreateUserRequest);
    }
  }
}
