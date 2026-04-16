import { Injectable, inject, signal, computed, DOCUMENT } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { AppConfigService } from '@features/api-client';

export type ThemeMode = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);
  private readonly document = inject(DOCUMENT);

  private readonly _mode = signal<ThemeMode>('dark');

  readonly mode = this._mode.asReadonly();
  readonly isDark = computed(() => this._mode() === 'dark');

  initialize(): void {
    // Apply stored preference or default to dark
    this.applyTheme(this._mode());
    this.loadPreference();
  }

  toggle(): void {
    const newMode: ThemeMode = this._mode() === 'dark' ? 'light' : 'dark';
    this._mode.set(newMode);
    this.applyTheme(newMode);
    this.savePreference(newMode);
  }

  private applyTheme(mode: ThemeMode): void {
    const html = this.document.documentElement;
    html.classList.remove('light-theme', 'dark-theme');
    html.classList.add(`${mode}-theme`);
  }

  private loadPreference(): void {
    this.http
      .get<{ theme: ThemeMode }>(`${this.config.backendUrl}/theme`, { withCredentials: true })
      .subscribe({
        next: response => {
          this._mode.set(response.theme);
          this.applyTheme(response.theme);
        },
      });
  }

  private savePreference(mode: ThemeMode): void {
    this.http
      .put(`${this.config.backendUrl}/theme`, { theme: mode }, { withCredentials: true })
      .subscribe();
  }
}
