import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, of } from 'rxjs';

import { AppConfigService } from '@features/api-client';

import { User, LoginCredentials } from '../types';
import { getPermissionsForRoles, hasPermission } from '../permissions/permissions.config';
import { Permission } from '../permissions/permissions.types';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);
  private readonly router = inject(Router);

  private readonly _user = signal<User | null>(null);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);
  private lastCheckTime = 0;
  private readonly CHECK_CACHE_DURATION = 5000; // 5 seconds

  readonly user = this._user.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly permissions = computed(() => {
    const user = this._user();
    return user ? getPermissionsForRoles(user.roles) : [];
  });

  private get baseUrl(): string {
    return `${this.config.backendUrl}/auth`;
  }

  login(credentials: LoginCredentials): void {
    this._isLoading.set(true);
    this._error.set(null);

    // Include rememberMe in the request body for backend to handle session duration
    const loginPayload = {
      username: credentials.username,
      password: credentials.password,
      rememberMe: credentials.rememberMe || false
    };

    this.http.post<{ message: string; user: User }>(`${this.baseUrl}/login`, loginPayload, { withCredentials: true })
      .subscribe({
        next: response => {
          this._user.set(response.user);
          this._isLoading.set(false);
          this.router.navigate(['/']);
        },
        error: err => {
          this._error.set(err.error?.message ?? 'Login failed');
          this._isLoading.set(false);
        },
      });
  }

  logout(): void {
    this.http.post(`${this.baseUrl}/logout`, {}, { withCredentials: true })
      .subscribe({
        complete: () => {
          this._user.set(null);
          this.lastCheckTime = 0; // Reset cache
          this.router.navigate(['/login']);
        },
        error: () => {
          this._user.set(null);
          this.lastCheckTime = 0; // Reset cache
          this.router.navigate(['/login']);
        },
      });
  }

  checkAuth(): Observable<User | null> {
    // If user is already authenticated, return immediately
    if (this._user()) {
      return of(this._user());
    }

    // If we've checked recently and found no user, avoid repeated calls
    const now = Date.now();
    if (now - this.lastCheckTime < this.CHECK_CACHE_DURATION && !this._user()) {
      return of(null);
    }

    this._isLoading.set(true);
    this.lastCheckTime = now;

    return this.http.get<User>(`${this.baseUrl}/check`, { withCredentials: true }).pipe(
      tap(user => {
        this._user.set(user);
        this._isLoading.set(false);
      }),
      catchError(() => {
        this._user.set(null);
        this._isLoading.set(false);
        return of(null);
      }),
    );
  }

  hasPermission(permission: Permission): boolean {
    return hasPermission(this.permissions(), permission);
  }
}
