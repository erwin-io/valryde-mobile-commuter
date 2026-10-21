import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { REQUIRES_AUTH } from './auth-api.service';
import { SessionService } from './session.service';

/**
 * Adds the bearer token only to requests flagged with REQUIRES_AUTH, so tokens never reach map tiles
 * or other hosts. A 401 triggers one refresh and one retry; a second 401 is returned to the caller.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.context.get(REQUIRES_AUTH)) return next(req);
  const session = inject(SessionService);
  const withToken = (request: HttpRequest<unknown>, token: string | null) =>
    token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;

  return from(session.validAccessToken()).pipe(
    switchMap((token) => next(withToken(req, token))),
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) return throwError(() => error);
      return from(session.refresh()).pipe(
        switchMap(() => session.validAccessToken()),
        switchMap((token) => next(withToken(req, token))),
      );
    }),
  );
};
