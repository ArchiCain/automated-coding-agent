import { NgModule } from '@angular/core';
import { NavigationTreeComponent } from './components/navigation-tree/navigation-tree.component';
import { LeftNavigationSidebarComponent } from './components/left-navigation-sidebar/left-navigation-sidebar.component';
import { LeftNavigationDrawerComponent } from './components/left-navigation-drawer/left-navigation-drawer.component';

@NgModule({
  imports: [NavigationTreeComponent, LeftNavigationSidebarComponent, LeftNavigationDrawerComponent],
  exports: [NavigationTreeComponent, LeftNavigationSidebarComponent, LeftNavigationDrawerComponent],
})
export class NavigationModule {}
