import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

const MUTABLE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const AUTH_RETRIED = new HttpContextToken(() => false);

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const prepared = prepareRequest(request, auth);

  return next(prepared).pipe(
    catchError((error: HttpErrorResponse) => {
      const isAuthRequest = prepared.url.includes('/api/auth/');
      if (error.status !== 401 || isAuthRequest || prepared.context.get(AUTH_RETRIED)) {
        return throwError(() => error);
      }

      return auth.refresh().pipe(
        catchError((refreshError) => {
          auth.clearSession();
          return throwError(() => refreshError);
        }),
        switchMap(() => next(prepareRequest(prepared.clone({
          context: prepared.context.set(AUTH_RETRIED, true),
        }), auth) )),
      );
    }),
  );
};

function prepareRequest(request: HttpRequest<unknown>, auth: AuthService): HttpRequest<unknown> {
  let headers = request.headers;
  if (MUTABLE_METHODS.has(request.method)) {
    const csrfToken = auth.csrfToken(request.url.includes('/api/auth/refresh'));
    if (csrfToken) headers = headers.set('X-CSRF-TOKEN', csrfToken);
  }
  return request.clone({ withCredentials: true, headers });
}
