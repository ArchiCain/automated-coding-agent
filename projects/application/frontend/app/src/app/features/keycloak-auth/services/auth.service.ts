import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, of, map } from 'rxjs';

import { AppConfigService, SessionManagementService } from '@features/api-client';

import { User, LoginCredentials } from '../types';
import { getPermissionsForRoles, hasPermission } from '../permissions/permissions.config';
import { Permission } from '../permissions/permissions.types';

interface CheckAuthResponse {
  authenticated: boolean;
  user: User;
  permissions: Permission[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);
  private readonly router = inject(Router);
  private readonly session = inject(SessionManagementService);

  private readonly _user = signal<User | null>(null);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);

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

    this.http.post<{ message: string; user: User }>(`${this.baseUrl}/login`, credentials, { withCredentials: true })
      .subscribe({
        next: response => {
          this._user.set(response.user);
          this._isLoading.set(false);
          this.session.startTimers();
          this.router.navigate(['/']);
        },
        error: err => {
          this._error.set(err.error?.message ?? 'Login failed');
          this._isLoading.set(false);
        },
      });
  }

  logout(): void {
    this.session.stopTimers();
    this.http.post(`${this.baseUrl}/logout`, {}, { withCredentials: true })
      .subscribe({
        complete: () => {
          this._user.set(null);
          this.router.navigate(['/login']);
        },
        error: () => {
          this._user.set(null);
          this.router.navigate(['/login']);
        },
      });
  }

  checkAuth(): Observable<User | null> {
    this._isLoading.set(true);
    return this.http.get<CheckAuthResponse>(`${this.baseUrl}/check`, { withCredentials: true }).pipe(
      map(response => {
        this._user.set(response.user);
        this._isLoading.set(false);
        this.session.startTimers();
        return response.user;
      }),
      catchError(() => {
        this._user.set(null);
        this._isLoading.set(false);
        this.session.stopTimers();
        return of(null);
      }),
    );
  }

  hasPermission(permission: Permission): boolean {
    return hasPermission(this.permissions(), permission);
  }
}
