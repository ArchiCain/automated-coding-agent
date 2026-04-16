import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog } from '@angular/material/dialog';
import { Sort } from '@angular/material/sort';

import { ConfirmationModalComponent, ConfirmationModalData } from '@features/shared';

import { UserManagementApiService } from '../services/user-management.api';
import { UsersTableComponent } from '../components/users-table/users-table.component';
import { User, UserListQuery } from '../types';

@Component({
  selector: 'app-users-page',
  imports: [MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, UsersTableComponent],
  template: `
    <div class="users-page">
      <div class="page-header">
        <h1>Users</h1>
        <button mat-flat-button (click)="router.navigate(['/admin/users/new'])">
          <mat-icon>add</mat-icon>
          New User
        </button>
      </div>

      <mat-form-field appearance="outline" class="search-field">
        <mat-label>Search users</mat-label>
        <input matInput (input)="onSearch($event)" placeholder="Search by username or email..." />
        <mat-icon matSuffix>search</mat-icon>
      </mat-form-field>

      <app-users-table
        [users]="users()"
        (editUser)="onEdit($event)"
        (deleteUser)="onDelete($event)"
        (sortChange)="onSort($event)"
      />
    </div>
  `,
  styles: [`
    .users-page { padding: 0; }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    .page-header h1 { margin: 0; }
    .search-field { width: 100%; max-width: 400px; margin-bottom: 16px; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersPage implements OnInit {
  readonly router = inject(Router);
  private readonly userApi = inject(UserManagementApiService);
  private readonly dialog = inject(MatDialog);

  readonly users = signal<User[]>([]);
  private query: UserListQuery = { page: 1, limit: 25 };

  ngOnInit(): void {
    this.loadUsers();
  }

  onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.query = { ...this.query, search: value, page: 1 };
    this.loadUsers();
  }

  onSort(sort: Sort): void {
    this.query = { ...this.query, sortBy: sort.active, sortOrder: sort.direction || 'asc' };
    this.loadUsers();
  }

  onEdit(user: User): void {
    this.router.navigate(['/admin/users', user.id]);
  }

  onDelete(user: User): void {
    const ref = this.dialog.open(ConfirmationModalComponent, {
      data: {
        title: 'Delete User',
        message: `Are you sure you want to delete "${user.username}"?`,
        confirmText: 'Delete',
      } satisfies ConfirmationModalData,
    });

    ref.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.userApi.deleteUser(user.id).subscribe(() => this.loadUsers());
      }
    });
  }

  private loadUsers(): void {
    this.userApi.getUsers(this.query).subscribe(response => {
      this.users.set(response.users);
    });
  }
}
