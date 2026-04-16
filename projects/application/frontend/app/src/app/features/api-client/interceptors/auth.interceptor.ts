import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { inject } from '@angular/core';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, filter, switchMap, take } from 'rxjs/operators';

import { SessionManagementService } from '../services/session-management.service';

let isRefreshing = false;
const refreshSubject = new BehaviorSubject<boolean>(false);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const sessionService = inject(SessionManagementService);

  const authReq = req.clone({ withCredentials: true });

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/')) {
        return handleUnauthorized(authReq, next, sessionService);
      }
      return throwError(() => error);
    }),
  );
};

function handleUnauthorized(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  sessionService: SessionManagementService,
): Observable<HttpEvent<unknown>> {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshSubject.next(false);

    return sessionService.refreshToken().pipe(
      switchMap(() => {
        isRefreshing = false;
        refreshSubject.next(true);
        return next(req);
      }),
      catchError(err => {
        isRefreshing = false;
        sessionService.logout();
        return throwError(() => err);
      }),
    );
  }

  return refreshSubject.pipe(
    filter(ready => ready),
    take(1),
    switchMap(() => next(req)),
  );
}
