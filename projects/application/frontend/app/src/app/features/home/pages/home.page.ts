import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';

import { AuthService } from '@features/keycloak-auth/services/auth.service';
import { navigationConfig } from '@features/navigation-config';
import { NavigationItem } from '@features/navigation-config';
import { BackendHealthCheckComponent } from '@features/testing-tools';
import { TypeormDatabaseClientComponent } from '@features/testing-tools';

import { FeatureCardComponent } from '../components/feature-card/feature-card.component';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [
    BackendHealthCheckComponent,
    TypeormDatabaseClientComponent,
    FeatureCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      padding: 24px;
    }

    h1 {
      margin: 0 0 24px;
    }

    .status-row {
      display: flex;
      gap: 16px;
      margin-bottom: 32px;
      flex-wrap: wrap;
    }

    .card-grid {
      display: grid;
      gap: 16px;
      grid-template-columns: 1fr;
    }

    @media (min-width: 600px) {
      .card-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (min-width: 960px) {
      .card-grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }
  `,
  template: `
    <h1>Welcome back, {{ displayName() }}</h1>

    <div class="status-row">
      <app-backend-health-check />
      <app-typeorm-database-client />
    </div>

    <div class="card-grid">
      @for (item of visibleCards(); track item.id) {
        <app-feature-card [item]="item" />
      }
    </div>
  `,
})
export class HomePage {
  private readonly auth = inject(AuthService);

  readonly displayName = computed(() => {
    const user = this.auth.user();
    return user?.firstName || user?.username || 'User';
  });

  readonly visibleCards = computed(() => {
    const flat = this.flattenItems(navigationConfig.items);
    return flat.filter(item => {
      if (!item.permission) return true;
      return this.auth.hasPermission(item.permission as any);
    });
  });

  private flattenItems(items: NavigationItem[]): NavigationItem[] {
    const result: NavigationItem[] = [];
    for (const item of items) {
      if (item.route) {
        result.push(item);
      }
      if (item.children) {
        result.push(...this.flattenItems(item.children));
      }
    }
    return result;
  }
}
