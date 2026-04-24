import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import { NavigationItem } from '@features/navigation-config';

@Component({
  selector: 'app-feature-card',
  standalone: true,
  imports: [RouterLink, MatCardModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }

    a.card-link {
      text-decoration: none;
      color: inherit;
      display: block;
    }

    mat-card {
      cursor: pointer;
      transition: box-shadow 0.2s ease;
      height: 100%;
    }

    mat-card:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .card-content {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
    }

    mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      color: var(--mat-sys-primary, #6750a4);
    }

    .card-label {
      font-size: 16px;
      font-weight: 500;
    }
  `,
  template: `
    <a class="card-link" [routerLink]="item().route">
      <mat-card>
        <div class="card-content">
          <mat-icon>{{ item().icon }}</mat-icon>
          <span class="card-label">{{ item().label }}</span>
        </div>
      </mat-card>
    </a>
  `,
})
export class FeatureCardComponent {
  readonly item = input.required<NavigationItem>();
}
