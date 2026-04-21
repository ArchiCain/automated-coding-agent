import { Component, ChangeDetectionStrategy, inject, input, output, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';

import { Role } from '@features/keycloak-auth';

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

  readonly availableRoles: Role[] = ['admin', 'user'];

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    temporaryPassword: [''],
    firstName: [''],
    lastName: [''],
    role: ['user' as Role, Validators.required],
  });

  get isEditMode(): boolean {
    return this.user() !== null;
  }

  ngOnInit(): void {
    const existingUser = this.user();
    if (existingUser) {
      this.form.patchValue({
        email: existingUser.email,
        firstName: existingUser.firstName ?? '',
        lastName: existingUser.lastName ?? '',
        role: this.pickPrimaryRole(existingUser.roles),
      });
      this.form.get('email')?.disable();
      this.form.get('temporaryPassword')?.clearValidators();
    } else {
      this.form.get('temporaryPassword')?.setValidators([
        Validators.required,
        Validators.minLength(8),
      ]);
    }
    this.form.get('temporaryPassword')?.updateValueAndValidity();
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    const raw = this.form.getRawValue();
    if (this.isEditMode) {
      const update: UpdateUserRequest = {
        firstName: raw.firstName || undefined,
        lastName: raw.lastName || undefined,
        role: raw.role ?? undefined,
      };
      this.submitForm.emit(update);
    } else {
      const create: CreateUserRequest = {
        email: raw.email!,
        firstName: raw.firstName || undefined,
        lastName: raw.lastName || undefined,
        temporaryPassword: raw.temporaryPassword!,
        role: raw.role!,
      };
      this.submitForm.emit(create);
    }
  }

  private pickPrimaryRole(roles: Role[]): Role {
    if (roles.includes('admin')) return 'admin';
    return 'user';
  }
}
