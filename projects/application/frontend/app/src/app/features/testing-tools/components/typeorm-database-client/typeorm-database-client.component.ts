import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatListModule } from '@angular/material/list';

import { TestingToolsApiService } from '../../services/testing-tools.api';
import { DatabaseCheckResult } from '../../types';

@Component({
  selector: 'app-typeorm-database-client',
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatListModule],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>Database Connection</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        @if (loading()) {
          <mat-spinner diameter="24" />
        } @else if (result()) {
          <div class="result" [class.connected]="result()?.connected" [class.error]="!result()?.connected">
            <mat-icon>{{ result()?.connected ? 'storage' : 'error' }}</mat-icon>
            <span>{{ result()?.connected ? 'Connected' : result()?.error }}</span>
          </div>
          @if (result()?.tables?.length) {
            <mat-list dense>
              @for (table of result()?.tables; track table) {
                <mat-list-item>{{ table }}</mat-list-item>
              }
            </mat-list>
          }
        }
      </mat-card-content>
      <mat-card-actions>
        <button mat-button (click)="check()" [disabled]="loading()">Check</button>
      </mat-card-actions>
    </mat-card>
  `,
  styles: [`
    .result { display: flex; align-items: center; gap: 8px; padding: 8px 0; }
    .result.connected mat-icon { color: var(--app-success); }
    .result.error mat-icon { color: var(--app-error); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TypeormDatabaseClientComponent {
  private readonly api = inject(TestingToolsApiService);
  readonly loading = signal(false);
  readonly result = signal<DatabaseCheckResult | null>(null);

  check(): void {
    this.loading.set(true);
    this.api.checkDatabase().subscribe({
      next: res => { this.result.set(res); this.loading.set(false); },
      error: err => { this.result.set({ connected: false, error: err.message }); this.loading.set(false); },
    });
  }
}
