import { ApplicationConfig, provideBrowserGlobalErrorListeners, inject, provideAppInitializer } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { routes } from './app.routes';
import { AppConfigService } from './features/api-client/services/app-config.service';
import { authInterceptor } from './features/api-client/interceptors/auth.interceptor';
import { activityInterceptor } from './features/api-client/interceptors/activity.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, activityInterceptor])),
    provideAnimationsAsync(),
    provideAppInitializer(() => {
      const configService = inject(AppConfigService);
      return configService.load();
    }),
  ],
};
