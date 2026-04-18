import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { SessionManagementService } from '../services/session-management.service';

/** Records user activity on every HTTP request to reset the inactivity timer. */
export const activityInterceptor: HttpInterceptorFn = (req, next) => {
  const sessionService = inject(SessionManagementService);
  sessionService.recordActivity();
  return next(req);
};
