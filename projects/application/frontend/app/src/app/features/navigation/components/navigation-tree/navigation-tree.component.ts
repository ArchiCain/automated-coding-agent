import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';

import { NavigationItem } from '@features/navigation-config';

@Component({
  selector: 'app-navigation-tree',
  imports: [RouterLink, RouterLinkActive, MatListModule, MatIconModule, MatExpansionModule],
  template: `
    <mat-nav-list>
      @for (item of items(); track item.id) {
        @if (item.children) {
          <mat-expansion-panel [class.mat-elevation-z0]="true" class="nav-group">
            <mat-expansion-panel-header>
              <mat-panel-title>
                @if (item.icon) {
                  <mat-icon class="nav-icon">{{ item.icon }}</mat-icon>
                }
                {{ item.label }}
              </mat-panel-title>
            </mat-expansion-panel-header>
            <mat-nav-list>
              @for (child of item.children; track child.id) {
                <a mat-list-item [routerLink]="child.route" routerLinkActive="active-link">
                  @if (child.icon) {
                    <mat-icon matListItemIcon>{{ child.icon }}</mat-icon>
                  }
                  <span matListItemTitle>{{ child.label }}</span>
                </a>
              }
            </mat-nav-list>
          </mat-expansion-panel>
        } @else {
          <a mat-list-item [routerLink]="item.route" routerLinkActive="active-link">
            @if (item.icon) {
              <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
            }
            <span matListItemTitle>{{ item.label }}</span>
          </a>
        }
      }
    </mat-nav-list>
  `,
  styles: [`
    .nav-group {
      background: transparent;
    }
    .nav-icon {
      margin-right: 8px;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
    .active-link {
      background-color: var(--app-hover-overlay);
      font-weight: 600;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
/** Renders a tree of navigation items as mat-list links with optional expansion panels for groups. */
export class NavigationTreeComponent {
  readonly items = input.required<NavigationItem[]>();
}
