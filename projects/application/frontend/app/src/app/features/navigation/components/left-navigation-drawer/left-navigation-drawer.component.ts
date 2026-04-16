import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { MatSidenavModule } from '@angular/material/sidenav';

import { navigationConfig } from '@features/navigation-config';

import { NavigationTreeComponent } from '../navigation-tree/navigation-tree.component';

@Component({
  selector: 'app-left-navigation-drawer',
  imports: [MatSidenavModule, NavigationTreeComponent],
  template: `
    <mat-drawer
      [opened]="opened()"
      mode="over"
      (closed)="closed.emit()"
      class="navigation-drawer"
    >
      <app-navigation-tree [items]="navItems" />
    </mat-drawer>
  `,
  styles: [`
    .navigation-drawer {
      width: 280px;
      background-color: var(--app-bg-paper);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeftNavigationDrawerComponent {
  readonly opened = input(false);
  readonly closed = output<void>();
  readonly navItems = navigationConfig.items;
}
