import { Component, ChangeDetectionStrategy } from '@angular/core';

import { BackendHealthCheckComponent } from '../components/backend-health-check/backend-health-check.component';
import { TypeormDatabaseClientComponent } from '../components/typeorm-database-client/typeorm-database-client.component';

@Component({
  selector: 'app-smoke-tests-page',
  imports: [BackendHealthCheckComponent, TypeormDatabaseClientComponent],
  template: `
    <div class="smoke-tests-page">
      <h1>Smoke Tests</h1>
      <div class="checks-grid">
        <app-backend-health-check />
        <app-typeorm-database-client />
      </div>
    </div>
  `,
  styles: [`
    .smoke-tests-page h1 { margin-bottom: 24px; }
    .checks-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 24px;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SmokeTestsPage {}
