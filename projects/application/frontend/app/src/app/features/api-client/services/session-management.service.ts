import { Injectable, inject, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, Subscription, interval } from 'rxjs';

import { AppConfigService } from './app-config.service';

const REFRESH_INTERVAL_MS = 4 * 60 * 1000; // 4 minutes
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

@Injectable({ providedIn: 'root' })
export class SessionManagementService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);
  private readonly router = inject(Router);

  private lastActivity = Date.now();
  private refreshSub: Subscription | null = null;
  private inactivitySub: Subscription | null = null;

  startTimers(): void {
    this.stopTimers();

    // Proactive token refresh every 4 minutes
    this.refreshSub = interval(REFRESH_INTERVAL_MS).subscribe(() => {
      this.refreshToken().subscribe();
    });

    // Inactivity check every minute
    this.inactivitySub = interval(60_000).subscribe(() => {
      if (Date.now() - this.lastActivity > INACTIVITY_TIMEOUT_MS) {
        this.logout();
      }
    });
  }

  stopTimers(): void {
    this.refreshSub?.unsubscribe();
    this.refreshSub = null;
    this.inactivitySub?.unsubscribe();
    this.inactivitySub = null;
  }

  recordActivity(): void {
    this.lastActivity = Date.now();
  }

  refreshToken(): Observable<unknown> {
    return this.http.post(
      `${this.config.backendUrl}/auth/refresh`,
      {},
      { withCredentials: true },
    );
  }

  logout(): void {
    this.stopTimers();
    this.http
      .post(`${this.config.backendUrl}/auth/logout`, {}, { withCredentials: true })
      .subscribe({
        complete: () => this.router.navigate(['/login']),
        error: () => this.router.navigate(['/login']),
      });
  }

  ngOnDestroy(): void {
    this.stopTimers();
  }
}
