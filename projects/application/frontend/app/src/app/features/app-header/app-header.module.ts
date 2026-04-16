import { NgModule } from '@angular/core';
import { AppHeaderComponent } from './components/app-header/app-header.component';
import { AvatarMenuComponent } from './components/avatar-menu/avatar-menu.component';

@NgModule({
  imports: [AppHeaderComponent, AvatarMenuComponent],
  exports: [AppHeaderComponent, AvatarMenuComponent],
})
export class AppHeaderModule {}
