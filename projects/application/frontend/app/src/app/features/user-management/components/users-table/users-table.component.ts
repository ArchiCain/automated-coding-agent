import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { DatePipe } from '@angular/common';

import { User } from '../../types';

@Component({
  selector: 'app-users-table',
  imports: [MatTableModule, MatSortModule, MatButtonModule, MatIconModule, MatChipsModule, DatePipe],
  templateUrl: './users-table.component.html',
  styleUrl: './users-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersTableComponent {
  readonly users = input.required<User[]>();
  readonly editUser = output<User>();
  readonly deleteUser = output<User>();
  readonly sortChange = output<Sort>();

  readonly displayedColumns = ['username', 'email', 'roles', 'createdTimestamp', 'actions'];
}
