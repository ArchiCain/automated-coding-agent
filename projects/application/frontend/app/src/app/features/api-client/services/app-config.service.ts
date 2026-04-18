import { Injectable, signal } from '@angular/core';

/** Runtime application configuration loaded from `/config.json`. */
export interface AppConfig {
  backendUrl: string;
}

const REQUIRED_KEYS: (keyof AppConfig)[] = ['backendUrl'];

/** Loads and provides runtime config from `/config.json`. Must complete before app renders (APP_INITIALIZER). */
@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private readonly _config = signal<AppConfig | null>(null);
  readonly config = this._config.asReadonly();

  get backendUrl(): string {
    const config = this._config();
    if (!config) {
      throw new Error('App config not loaded. Ensure APP_INITIALIZER completed.');
    }
    return config.backendUrl;
  }

  async load(): Promise<void> {
    const response = await fetch('/config.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(
        `Failed to load /config.json (${response.status}). ` +
          'Ensure config.json is served by nginx or the dev server.',
      );
    }

    const config: AppConfig = await response.json();

    const missing = REQUIRED_KEYS.filter(key => !config[key]);
    if (missing.length > 0) {
      throw new Error(
        `Missing required config keys in /config.json: ${missing.join(', ')}. ` +
          'All keys must be present and non-empty.',
      );
    }

    this._config.set(config);
  }
}
