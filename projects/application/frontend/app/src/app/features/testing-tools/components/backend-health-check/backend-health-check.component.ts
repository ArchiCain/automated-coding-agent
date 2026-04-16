import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { TestingToolsApiService } from '../../services/testing-tools.api';
import { HealthCheckResult } from '../../types';

@Component({
  selector: 'app-backend-health-check',
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>Backend Health</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        @if (loading()) {
          <mat-spinner diameter="24" />
        } @else if (result()) {
          <div class="result" [class.ok]="result()?.status === 'ok'" [class.error]="result()?.status === 'error'">
            <mat-icon>{{ result()?.status === 'ok' ? 'check_circle' : 'error' }}</mat-icon>
            <span>{{ result()?.status === 'ok' ? 'Healthy' : result()?.error }}</span>
            @if (result()?.responseTime) {
              <span class="response-time">{{ result()?.responseTime }}ms</span>
            }
          </div>
        }
      </mat-card-content>
      <mat-card-actions>
        <button mat-button (click)="check()" [disabled]="loading()">Check</button>
      </mat-card-actions>
    </mat-card>
  `,
  styles: [`
    .result { display: flex; align-items: center; gap: 8px; padding: 8px 0; }
    .result.ok mat-icon { color: var(--app-success); }
    .result.error mat-icon { color: var(--app-error); }
    .response-time { color: var(--app-text-secondary); font-size: 0.875rem; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackendHealthCheckComponent {
  private readonly api = inject(TestingToolsApiService);
  readonly loading = signal(false);
  readonly result = signal<HealthCheckResult | null>(null);

  check(): void {
    this.loading.set(true);
    this.api.checkBackendHealth().subscribe(res => {
      this.result.set(res);
      this.loading.set(false);
    });
  }
}
