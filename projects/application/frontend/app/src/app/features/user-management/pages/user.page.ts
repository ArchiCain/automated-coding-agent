import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';

import { UserManagementApiService } from '../services/user-management.api';
import { UserFormComponent } from '../components/user-form/user-form.component';
import { User, CreateUserRequest, UpdateUserRequest } from '../types';

@Component({
  selector: 'app-user-page',
  imports: [MatCardModule, UserFormComponent],
  template: `
    <div class="user-page">
      <h1>{{ isEditMode ? 'Edit User' : 'Create User' }}</h1>
      <mat-card>
        <mat-card-content>
          <app-user-form
            [user]="user()"
            (submitForm)="onSubmit($event)"
            (cancelForm)="router.navigate(['/admin/users'])"
          />
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .user-page { max-width: 800px; }
    h1 { margin-bottom: 24px; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  private readonly userApi = inject(UserManagementApiService);

  readonly user = signal<User | null>(null);

  get isEditMode(): boolean {
    return !!this.route.snapshot.params['id'];
  }

  ngOnInit(): void {
    const id = this.route.snapshot.params['id'];
    if (id) {
      this.userApi.getUser(id).subscribe(user => this.user.set(user));
    }
  }

  onSubmit(data: CreateUserRequest | UpdateUserRequest): void {
    const id = this.route.snapshot.params['id'];
    if (id) {
      this.userApi.updateUser(id, data as UpdateUserRequest).subscribe(() => {
        this.router.navigate(['/admin/users']);
      });
    } else {
      this.userApi.createUser(data as CreateUserRequest).subscribe(() => {
        this.router.navigate(['/admin/users']);
      });
    }
  }
}
