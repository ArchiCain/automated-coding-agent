import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { AppConfigService } from '@features/api-client';

import { HealthCheckResult, DatabaseCheckResult } from '../types';

@Injectable({ providedIn: 'root' })
export class TestingToolsApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  checkBackendHealth(): Observable<HealthCheckResult> {
    const start = Date.now();
    return new Observable<HealthCheckResult>(subscriber => {
      this.http.get<{ status: string }>(`${this.config.backendUrl}/health`, { withCredentials: true })
        .subscribe({
          next: _response => {
            subscriber.next({
              status: 'ok',
              service: 'backend',
              responseTime: Date.now() - start,
            });
            subscriber.complete();
          },
          error: err => {
            subscriber.next({
              status: 'error',
              service: 'backend',
              responseTime: Date.now() - start,
              error: err.message,
            });
            subscriber.complete();
          },
        });
    });
  }

  checkDatabase(): Observable<DatabaseCheckResult> {
    return this.http.get<DatabaseCheckResult>(
      `${this.config.backendUrl}/health/database`,
      { withCredentials: true },
    );
  }
}
