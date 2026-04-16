import { NgModule } from '@angular/core';
import { LoginPage } from './pages/login.page';
import { LoginFormComponent } from './components/login-form/login-form.component';
import { RequirePermissionDirective } from './directives/require-permission.directive';

@NgModule({
  imports: [LoginPage, LoginFormComponent, RequirePermissionDirective],
  exports: [LoginPage, LoginFormComponent, RequirePermissionDirective],
})
export class KeycloakAuthModule {}
