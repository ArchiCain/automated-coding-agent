import { Component, ChangeDetectionStrategy } from '@angular/core';

import { navigationConfig } from '@features/navigation-config';

import { NavigationTreeComponent } from '../navigation-tree/navigation-tree.component';

@Component({
  selector: 'app-left-navigation-sidebar',
  imports: [NavigationTreeComponent],
  template: `
    <nav class="sidebar">
      <app-navigation-tree [items]="navItems" />
    </nav>
  `,
  styles: [`
    .sidebar {
      width: 280px;
      height: 100%;
      overflow-y: auto;
      border-right: 1px solid var(--app-divider);
      background-color: var(--app-bg-paper);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeftNavigationSidebarComponent {
  readonly navItems = navigationConfig.items;
}
