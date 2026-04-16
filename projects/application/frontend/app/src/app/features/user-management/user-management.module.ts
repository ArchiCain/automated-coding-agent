import { NgModule } from '@angular/core';
import { UsersPage } from './pages/users.page';
import { UserPage } from './pages/user.page';
import { UsersTableComponent } from './components/users-table/users-table.component';
import { UserFormComponent } from './components/user-form/user-form.component';

@NgModule({
  imports: [UsersPage, UserPage, UsersTableComponent, UserFormComponent],
  exports: [UsersPage, UserPage, UsersTableComponent, UserFormComponent],
})
export class UserManagementModule {}
