import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';

import { AppHeaderComponent } from '@features/app-header';
import { LeftNavigationSidebarComponent } from '@features/navigation';

import { LayoutService } from '../../services/layout.service';

@Component({
  selector: 'app-layout',
  imports: [
    RouterOutlet,
    MatSidenavModule,
    AppHeaderComponent,
    LeftNavigationSidebarComponent,
  ],
  templateUrl: './app-layout.component.html',
  styleUrl: './app-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppLayoutComponent {
  readonly layout = inject(LayoutService);
}
