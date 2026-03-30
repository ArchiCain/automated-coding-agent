import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

export interface BreadcrumbItem {
  label: string;
  route: string;
}

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule],
  template: `
    <nav class="breadcrumb">
      @for (item of items; track item.route; let last = $last) {
        @if (!last) {
          <a class="breadcrumb-link" [routerLink]="item.route">{{ item.label }}</a>
          <mat-icon class="breadcrumb-separator">chevron_right</mat-icon>
        } @else {
          <span class="breadcrumb-current">{{ item.label }}</span>
        }
      }
    </nav>
  `,
  styles: [`
    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
      margin-bottom: 16px;
    }

    .breadcrumb-link {
      color: #7c4dff;
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }

    .breadcrumb-separator {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #999;
    }

    .breadcrumb-current {
      color: #666;
      font-weight: 500;
    }
  `],
})
export class BreadcrumbComponent {
  @Input({ required: true }) items: BreadcrumbItem[] = [];
}
